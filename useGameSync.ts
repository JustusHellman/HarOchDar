
import { useEffect, useCallback, useRef } from 'react';
import { GameState, Player, Location } from './types';
import { getLeanState } from './utils';
import { supabase } from './lib/supabase';

export type GameSyncMessage = 
  | { type: 'STATE_FULL'; state: GameState }
  | { type: 'STATE_DYNAMIC'; state: Partial<GameState> }
  | { type: 'REQUEST_SYNC' }
  | { type: 'PLAYER_JOIN_REQUEST'; player: Player }
  | { type: 'PLAYER_GUESS_REQUEST'; playerId: string; guess: Location; distance: number }
  | { type: 'PLAYER_UNLOCK_REQUEST'; playerId: string }
  | { type: 'PLAYER_LEAVE'; playerId: string }
  | { type: 'PLAYER_KICKED'; targetId: string }
  | { type: 'HOST_REVEAL_REQUEST' }
  | { type: 'FORCE_REVEAL' }
  | { type: 'TERMINATE_SESSION' };

export const useGameSync = (
  onStateUpdate: (state: GameState) => void, 
  onActionRequest: (action: any) => void,
  isHost: boolean, 
  gameState: GameState | null,
  roomId?: string | null,
  onKicked?: (targetId: string) => void,
  onSessionEnded?: () => void
) => {
  const channelRef = useRef<any>(null);
  const questionsCache = useRef<GameState['questions'] | null>(null);
  
  // Use refs for callbacks to prevent channel resubscription when they change
  const onStateUpdateRef = useRef(onStateUpdate);
  const onActionRequestRef = useRef(onActionRequest);
  const onKickedRef = useRef(onKicked);
  const onSessionEndedRef = useRef(onSessionEnded);

  useEffect(() => { onStateUpdateRef.current = onStateUpdate; }, [onStateUpdate]);
  useEffect(() => { onActionRequestRef.current = onActionRequest; }, [onActionRequest]);
  useEffect(() => { onKickedRef.current = onKicked; }, [onKicked]);
  useEffect(() => { onSessionEndedRef.current = onSessionEnded; }, [onSessionEnded]);

  const clearCache = useCallback(() => {
    questionsCache.current = null;
  }, []);

  const broadcast = useCallback((state: GameState, full = false) => {
    if (!channelRef.current) return;
    
    if (full) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'sync',
        payload: { type: 'STATE_FULL', state }
      });
    } else {
      const lean = getLeanState(state);
      channelRef.current.send({
        type: 'broadcast',
        event: 'sync',
        payload: { type: 'STATE_DYNAMIC', state: lean }
      });
    }
  }, []);

  const sendAction = useCallback((message: GameSyncMessage) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'sync',
        payload: message
      });
    }
  }, []);

  const requestSync = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'sync',
        payload: { type: 'REQUEST_SYNC' }
      });
    }
  }, []);

  const activeChannelId = gameState?.id || roomId;
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  useEffect(() => {
    if (!activeChannelId) return;

    const channel = supabase.channel(`game_${activeChannelId}`, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
      const data = payload as GameSyncMessage;
      
      if (data.type === 'STATE_FULL') {
        if (!isHost) {
          questionsCache.current = data.state.questions;
          onStateUpdateRef.current(data.state);
        }
      } else if (data.type === 'STATE_DYNAMIC') {
        if (!isHost) {
          if (questionsCache.current) {
            const reconstructedState = { 
              ...data.state, 
              questions: questionsCache.current 
            } as GameState;
            onStateUpdateRef.current(reconstructedState);
          } else {
            // Player received dynamic update before full state was ever received; request full sync
            requestSync();
          }
        }
      } else if (data.type === 'TERMINATE_SESSION') {
        if (!isHost) {
          onSessionEndedRef.current?.();
        }
      } else if (data.type === 'PLAYER_KICKED') {
        if (!isHost) {
          onKickedRef.current?.(data.targetId);
        }
      } else if (data.type === 'PLAYER_LEAVE') {
        // Host receives a notification that someone left voluntarily
        if (isHost) onActionRequestRef.current({ type: 'KICK_PLAYER', payload: data.playerId });
      } else if (data.type === 'REQUEST_SYNC') {
        if (isHost && gameStateRef.current) broadcast(gameStateRef.current, true);
      } else if (data.type === 'PLAYER_JOIN_REQUEST') {
        if (isHost) {
          onActionRequestRef.current({ type: 'JOIN_PLAYER', payload: data.player });
          if (gameStateRef.current) {
            broadcast(gameStateRef.current, true);
          }
        }
      } else if (data.type === 'PLAYER_GUESS_REQUEST') {
        if (isHost) onActionRequestRef.current({ type: 'SUBMIT_GUESS', payload: { playerId: data.playerId, guess: data.guess, distance: data.distance } });
      } else if (data.type === 'PLAYER_UNLOCK_REQUEST') {
        if (isHost) onActionRequestRef.current({ type: 'UNLOCK_GUESS', payload: data.playerId });
      } else if (data.type === 'HOST_REVEAL_REQUEST') {
        if (isHost) onActionRequestRef.current({ type: 'SET_STATUS', payload: 'COUNTDOWN' });
      } else if (data.type === 'FORCE_REVEAL') {
        if (isHost) onActionRequestRef.current({ type: 'FORCE_REVEAL' });
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
        if (!isHost) requestSync();
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [activeChannelId, isHost, broadcast, requestSync]);

  return { broadcast, sendAction, requestSync, clearCache };
};
