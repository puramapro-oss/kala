'use client';

interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
}

export default function ErrorState({
  title = 'Une erreur est survenue',
  message,
  retry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 text-alerte">
        <svg
          className="w-12 h-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="px-4 py-2 bg-primary-on-dark text-[#0A0A0F] rounded-lg hover:opacity-90 transition-opacity"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
