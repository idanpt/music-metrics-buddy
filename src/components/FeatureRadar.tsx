
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import type { AudioFeatures } from "@/types/spotify";

interface FeatureRadarProps {
  features: AudioFeatures;
}

export function FeatureRadar({ features }: FeatureRadarProps) {
  const data = [
    { name: "Danceability", value: features.danceability },
    { name: "Energy", value: features.energy },
    { name: "Speechiness", value: features.speechiness },
    { name: "Acousticness", value: features.acousticness },
    { name: "Liveness", value: features.liveness },
    { name: "Valence", value: features.valence },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="name" />
        <Radar
          name="Features"
          dataKey="value"
          stroke="#1DB954"
          fill="#1DB954"
          fillOpacity={0.6}
          animationBegin={0}
          animationDuration={1500}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
