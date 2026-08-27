'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface AjouterNoteProps {
  onNoteAjoutee: (texte: string) => void;
  onAnnuler: () => void;
}

export default function AjouterNote({ onNoteAjoutee, onAnnuler }: AjouterNoteProps) {
  const [texte, setTexte] = useState('');

  const handleValider = () => {
    if (!texte.trim()) return;
    onNoteAjoutee(texte.trim());
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-portee mb-4">Ajouter une note</h3>

      <div className="mb-4">
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Ex: L'élève a bien enchaîné ses gammes aujourd'hui, rythme plus solide..."
          rows={5}
          className="w-full px-3 py-2 bg-pupitre/30 border border-portee/20 rounded-lg text-portee placeholder-portee/40 focus:border-primary-on-dark focus:outline-none"
          autoFocus
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onAnnuler}>
          Annuler
        </Button>
        <Button variant="primary" onClick={handleValider} disabled={!texte.trim()}>
          Publier
        </Button>
      </div>
    </Card>
  );
}
