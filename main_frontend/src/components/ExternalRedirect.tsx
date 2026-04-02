import { useEffect } from "react";

type ExternalRedirectProps = {
  to: string;
};

const ExternalRedirect = ({ to }: ExternalRedirectProps) => {
  useEffect(() => {
    window.location.assign(to);
  }, [to]);

  return (
    <main className="flex-1 flex items-center justify-center">
      <span className="text-sm text-textSecondary dark:text-textSecondary-dark">
        Redirecting...
      </span>
    </main>
  );
};

export default ExternalRedirect;

