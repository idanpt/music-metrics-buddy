
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Callback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      if (!code) {
        navigate("/");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("spotify-auth", {
          body: { code },
        });

        if (error) throw error;

        // Store the tokens in localStorage
        localStorage.setItem("spotify_access_token", data.access_token);
        localStorage.setItem("spotify_refresh_token", data.refresh_token);

        // Redirect to home page
        navigate("/");
      } catch (error) {
        console.error("Error during callback:", error);
        navigate("/");
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse">Connecting to Spotify...</div>
    </div>
  );
};

export default Callback;
