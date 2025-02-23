
import { InsightCard } from "@/components/InsightCard";
import { GenresChart } from "@/components/GenresChart";
import { FeatureRadar } from "@/components/FeatureRadar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MusicIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const mockGenres = [
  { name: "Pop", count: 45 },
  { name: "Rock", count: 30 },
  { name: "Hip Hop", count: 25 },
  { name: "Electronic", count: 20 },
  { name: "Jazz", count: 15 },
];

const mockFeatures = {
  danceability: 0.735,
  energy: 0.578,
  key: 5,
  loudness: -11.84,
  mode: 0,
  speechiness: 0.0461,
  acousticness: 0.514,
  instrumentalness: 0.0902,
  liveness: 0.159,
  valence: 0.624,
  tempo: 98.002,
  id: "mock",
  duration_ms: 255349,
  time_signature: 4,
};

const Index = () => {
  const { toast } = useToast();

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary p-6">
      <div className="mx-auto max-w-6xl space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Music Metrics Buddy</h1>
          <p className="text-lg text-muted-foreground">
            Discover insights about your music taste
          </p>
          <Button
            size="lg"
            className="animate-fade-up"
            onClick={handleSpotifyLogin}
          >
            <MusicIcon className="mr-2 h-5 w-5" />
            Connect with Spotify
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <InsightCard title="Top Genres" className="animate-fade-up [animation-delay:200ms]">
            <GenresChart data={mockGenres} />
          </InsightCard>

          <InsightCard
            title="Music Characteristics"
            className="animate-fade-up [animation-delay:400ms]"
          >
            <FeatureRadar features={mockFeatures} />
          </InsightCard>
        </div>
      </div>
    </div>
  );
};

export default Index;
