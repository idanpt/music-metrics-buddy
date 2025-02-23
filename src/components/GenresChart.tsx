
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from "recharts";
import type { SpotifyGenre } from "@/types/spotify";

interface GenresChartProps {
  data: SpotifyGenre[];
}

const COLORS = ["#FF8042", "#00C49F", "#FFBB28", "#0088FE", "#FF0000"];

export function GenresChart({ data }: GenresChartProps) {
  const formattedData = data.map((genre) => ({
    name: genre.name,
    value: genre.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={formattedData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          animationBegin={0}
          animationDuration={1500}
        >
          {formattedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
