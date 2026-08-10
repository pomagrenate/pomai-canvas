export const PomaiWorkspaceBanner = ({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) => {
  return (
    <a
      href={
        isSignedIn
          ? (import.meta.env.VITE_APP_PLUS_APP || "http://localhost:4173")
          : `http://localhost:4173/login`
      }
      target="_blank"
      rel="noopener"
      className="plus-banner"
    >
      Pomai Whiteboard
    </a>
  );
};

/** @deprecated Use PomaiWorkspaceBanner instead */
export const ExcalidrawPlusPromoBanner = PomaiWorkspaceBanner;
