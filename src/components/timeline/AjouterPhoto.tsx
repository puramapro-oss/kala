'use client';

import { useState, useRef } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { createClient } from '@/lib/supabase';

interface AjouterPhotoProps {
  onPhotoAjoutee: (photoUrl: string, note?: string) => void;
  onAnnuler: () => void;
}

export default function AjouterPhoto({ onPhotoAjoutee, onAnnuler }: AjouterPhotoProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérification type et taille
    if (!file.type.startsWith('image/')) {
      setError('Le fichier doit être une image');
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      setError('L\'image ne doit pas dépasser 5 MB');
      return;
    }

    // Preview locale
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload vers Storage Supabase
    setUploading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      const filePath = `journal/${filename}`;

      // EX-053 : bucket privé (à créer si inexistant : `journal_garde_photos`)
      const { error: uploadError } = await supabase.storage
        .from('journal_garde_photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // EX-053 : URL signée courte (1h)
      const { data: urlData } = await supabase.storage
        .from('journal_garde_photos')
        .createSignedUrl(filePath, 3600);

      if (!urlData || !urlData.signedUrl) {
        throw new Error('Échec génération URL signée');
      }

      // Retourner l'URL publique (on garde le filePath pour régénérer l'URL signée au besoin)
      // Pour l'instant on stocke directement l'URL signée (V1 — amélioration post-lancement : stocker filePath + régénérer à la volée)
      onPhotoAjoutee(urlData.signedUrl, note.trim() || undefined);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Échec upload photo';
      setError(message);
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-creme mb-4">Ajouter une photo</h3>

      {error && (
        <div className="mb-4 p-3 bg-alerte/20 border border-alerte/40 rounded text-sm text-alerte">
          {error}
        </div>
      )}

      {preview && (
        <div className="mb-4">
          <img
            src={preview}
            alt="Aperçu"
            className="rounded-lg max-w-full h-auto max-h-64 object-cover"
          />
        </div>
      )}

      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          loading={uploading}
        >
          {preview ? 'Changer de photo' : 'Sélectionner une photo'}
        </Button>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-creme/80 mb-2">
          Note (optionnelle)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ajouter une note pour accompagner cette photo..."
          rows={3}
          className="w-full px-3 py-2 bg-corbeau/30 border border-creme/20 rounded-lg text-creme placeholder-creme/40 focus:border-primary-on-dark focus:outline-none"
          disabled={uploading}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onAnnuler} disabled={uploading}>
          Annuler
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            if (!preview) {
              setError('Veuillez sélectionner une photo');
              return;
            }
            // L'upload est déjà fait dans handleFileChange
            // on a juste à valider
          }}
          disabled={!preview || uploading}
        >
          Publier
        </Button>
      </div>
    </Card>
  );
}
