
import { useState, useEffect, useCallback } from 'react';
import { Trail, Question, Location, User } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { clearDraft } from '../lib/draftStorage';
import { generateId } from '../utils';

export const useTrails = (user: User | null) => {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTrails = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return;
    
    setIsLoading(true);
    try {
      const { data: trailsData, error: trailsError } = await supabase
        .from('trails')
        .select(`
          *,
          questions (*)
        `)
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (trailsError) throw trailsError;

      const formattedTrails: Trail[] = (trailsData || []).map(t => ({
        id: t.id,
        name: t.name,
        creatorId: t.creator_id,
        lastUpdated: new Date(t.created_at || Date.now()).getTime(),
        startingView: t.starting_view,
        questions: (t.questions || []).sort((a: any, b: any) => (a.position_order || 0) - (b.position_order || 0)).map((q: any) => ({
          id: q.id,
          imageUrl: q.image_url,
          location: q.location,
          title: q.title,
          locationSource: q.location_source,
          trailId: q.trail_id
        }))
      }));

      setTrails(formattedTrails);
    } catch (err) {
      console.error("Error loading trails:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTrails();
    }
  }, [loadTrails, user]);

  const saveTrail = async (questions: Question[], name: string, startingView?: { center: Location, zoom: number }, editingId?: string): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!isSupabaseConfigured) return { success: false, error: "Supabase not configured" };
    
    try {
      console.log("Starting Finalize Trail sequence...");
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { success: false, error: "No active session. Please re-login." };
      
      const sessionUserId = session.user.id;
      
      // ENSURE PROFILE EXISTS FIRST (Fixes potential RLS dependency issues)
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: sessionUserId,
        username: session.user.user_metadata?.username || session.user.email?.split('@')[0],
        updated_at: new Date().toISOString()
      });
      if (profileError) console.warn("Profile sync warning:", profileError.message);

      const trailData = {
        name: name || `Trail ${new Date().toLocaleDateString()}`,
        creator_id: sessionUserId,
        starting_view: startingView || null,
        updated_at: new Date().toISOString()
      };

      const cleanEditingId = (editingId && editingId.trim() !== '') ? editingId : undefined;
      let trailId = cleanEditingId;
      if (cleanEditingId) {
        console.log("Updating existing trail...");
        const { error: updateError } = await supabase.from('trails').update(trailData).eq('id', cleanEditingId);
        if (updateError) return { success: false, error: `Trail Table Error: ${updateError.message}` };
        
        await supabase.from('questions').delete().eq('trail_id', cleanEditingId);
      } else {
        console.log("Inserting new trail...");
        const { data: insertedData, error: insertError } = await supabase
          .from('trails')
          .insert([trailData])
          .select('id')
          .single();
        
        if (insertError) {
          console.error("Trails Insert Failure:", insertError);
          return { success: false, error: `Trails Table Error: ${insertError.message}` };
        }
        trailId = insertedData.id;
      }

      if (!trailId) return { success: false, error: "Failed to create trail entry." };

      // Ensure any images that are still local data URLs (e.g. captured while offline) get uploaded
      const questionsData = await Promise.all(questions.map(async (q, idx) => {
        let finalImageUrl = q.imageUrl;
        if (finalImageUrl.startsWith('data:')) {
          try {
            let blob: Blob;
            try {
              const res = await fetch(finalImageUrl);
              blob = await res.blob();
            } catch {
              const base64 = finalImageUrl.split(',')[1];
              if (base64) {
                const byteCharacters = atob(base64);
                const byteNumbers = new Uint8Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                blob = new Blob([byteNumbers], { type: 'image/jpeg' });
              } else {
                throw new Error("Invalid base64 image data");
              }
            }

            const fileName = `${generateId()}.jpg`;
            const { error: uploadErr } = await supabase.storage
              .from('trail-images')
              .upload(fileName, blob);
            if (!uploadErr) {
              const { data: { publicUrl } } = supabase.storage
                .from('trail-images')
                .getPublicUrl(fileName);
              finalImageUrl = publicUrl;
            }
          } catch (e) {
            console.error("Failed to upload local image on save:", e);
          }
        }

        return {
          trail_id: trailId,
          image_url: finalImageUrl,
          location: {
            lat: Number(q.location.lat),
            lng: Number(q.location.lng)
          },
          title: q.title || `Spot ${idx + 1}`,
          position_order: idx,
          location_source: q.locationSource || 'MANUAL'
        };
      }));

      console.log(`Inserting ${questionsData.length} questions...`);
      const { error: qError } = await supabase.from('questions').insert(questionsData);
      if (qError) {
        console.error("Questions Insert Failure:", qError);
        return { success: false, error: `Questions Table Error: ${qError.message}` };
      }

      console.log("Trail saved successfully!");
      await loadTrails();
      return { success: true, id: trailId };
    } catch (err: any) {
      console.error("CRITICAL APP ERROR:", err);
      return { success: false, error: err.message || "An unexpected error occurred" };
    }
  };

  const deleteTrail = async (id: string) => {
    if (!user || !isSupabaseConfigured) return;
    try {
      clearDraft(id);
      const { data: questionsData } = await supabase
        .from('questions')
        .select('image_url')
        .eq('trail_id', id);

      if (questionsData && questionsData.length > 0) {
        const fileNames = questionsData
          .filter(q => q.image_url && !q.image_url.startsWith('data:'))
          .map(q => q.image_url.split('/').pop())
          .filter(Boolean) as string[];

        if (fileNames.length > 0) {
          await supabase.storage.from('trail-images').remove(fileNames);
        }
      }

      await supabase.from('trails').delete().eq('id', id);
      setTrails(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error("Error deleting trail:", err);
    }
  };

  return { trails, saveTrail, deleteTrail, reloadTrails: loadTrails, isLoading };
};
