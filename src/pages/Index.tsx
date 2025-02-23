
import { InsightCard } from "@/components/InsightCard";
import { GenresChart } from "@/components/GenresChart";
import { FeatureRadar } from "@/components/FeatureRadar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MusicIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const Index = () => {
  const { toast } = useToast();

  const fetchSpotifyData = async () => {
    const access_token = localStorage.getItem("spotify_access_token");
    const refresh_token = localStorage.getItem("spotify_refresh_token");

    if (!access_token || !refresh_token) {
      throw new Error("No Spotify tokens found");
    }

    const { data, error } = await supabase.functions.invoke("spotify-data", {
      body: { access_token, refresh_token },
    });

    if (error) throw error;

    // Update access token if it was refreshed
    if (data.access_token) {
      localStorage.setItem("spotify_access_token", data.access_token);
    }

    return data;
  };

  const { data, isError, isLoading } = useQuery({
    queryKey: ["spotify-data"],
    queryFn: fetchSpotifyData,
    enabled: !!localStorage.getItem("spotify_access_token"),
    retry: false,
  });

  const handleSpotifyLogin = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("spotify-auth");
      
      if (error) throw error;
      
      // Redirect to Spotify's authorization page
      window.location.href = data.url;
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to connect to Spotify. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderContent = () => {
    if (!localStorage.getItem("spotify_access_token")) {
      return (
        <Button
          size="lg"
          className="animate-fade-up"
          onClick={handleSpotifyLogin}
        >
          <MusicIcon className="mr-2 h-5 w-5" />
          Connect with Spotify
        </Button>
      );
    }

    if (isLoading) {
      return (
        <Button size="lg" className="animate-fade-up" disabled>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading your music data...
        </Button>
      );
    }

    if (isError) {
      return (
        <div className="space-y-4">
          <p className="text-destructive">Failed to load your Spotify data</p>
          <Button
            size="lg"
            className="animate-fade-up"
            onClick={handleSpotifyLogin}
          >
            <MusicIcon className="mr-2 h-5 w-5" />
            Reconnect with Spotify
          </Button>
        </div>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2">
        <InsightCard title="Top Genres" className="animate-fade-up [animation-delay:200ms]">
          <GenresChart data={data.genres} />
        </InsightCard>

        <InsightCard
          title="Music Characteristics"
          className="animate-fade-up [animation-delay:400ms]"
        >
          <FeatureRadar features={data.features} />
        </InsightCard>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary p-6">
      <div className="mx-auto max-w-6xl space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Music Metrics Buddy</h1>
          <p className="text-lg text-muted-foreground">
            Discover insights about your music taste
          </p>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Index;
