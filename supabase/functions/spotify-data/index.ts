
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cache for token refresh (to avoid multiple refreshes during concurrent requests)
const tokenCache = new Map<string, { access_token: string, expires_at: number }>();

async function refreshAccessToken(refresh_token: string) {
  const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID')
  const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET')

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
    }),
  })

  const data = await response.json()
  return data.access_token
}

async function getValidAccessToken(access_token: string, refresh_token: string) {
  const cached = tokenCache.get(refresh_token);
  if (cached && cached.expires_at > Date.now()) {
    return cached.access_token;
  }

  const new_token = await refreshAccessToken(refresh_token);
  tokenCache.set(refresh_token, {
    access_token: new_token,
    expires_at: Date.now() + 3500 * 1000, // Slightly less than 1 hour
  });
  
  return new_token;
}

async function fetchTopTracks(access_token: string) {
  const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50', {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  return await response.json();
}

async function fetchAudioFeatures(access_token: string, trackIds: string[]) {
  const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds.join(',')}`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  return await response.json();
}

async function fetchArtists(access_token: string, artistIds: string[]) {
  const response = await fetch(`https://api.spotify.com/v1/artists?ids=${artistIds.join(',')}`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  return await response.json();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { access_token, refresh_token } = await req.json()
    
    if (!access_token || !refresh_token) {
      throw new Error('Missing tokens')
    }

    // Get a valid access token
    const valid_token = await getValidAccessToken(access_token, refresh_token);

    // Fetch top tracks
    const topTracks = await fetchTopTracks(valid_token);
    if (topTracks.error) throw new Error(topTracks.error.message);

    // Get unique artist IDs
    const artistIds = [...new Set(topTracks.items.flatMap(track => 
      track.artists.map(artist => artist.id)
    ))].slice(0, 50); // Spotify API limit

    // Fetch audio features for all tracks
    const audioFeatures = await fetchAudioFeatures(
      valid_token, 
      topTracks.items.map(track => track.id)
    );
    if (audioFeatures.error) throw new Error(audioFeatures.error.message);

    // Fetch artists to get genres
    const artists = await fetchArtists(valid_token, artistIds);
    if (artists.error) throw new Error(artists.error.message);

    // Calculate average audio features
    const avgFeatures = audioFeatures.audio_features.reduce((acc, feat) => {
      if (!feat) return acc;
      Object.keys(feat).forEach(key => {
        if (typeof feat[key] === 'number' && key !== 'duration_ms' && key !== 'time_signature') {
          acc[key] = (acc[key] || 0) + feat[key];
        }
      });
      return acc;
    }, {});

    Object.keys(avgFeatures).forEach(key => {
      avgFeatures[key] /= audioFeatures.audio_features.filter(f => f).length;
    });

    // Count genres
    const genreCounts = artists.artists.flatMap(artist => artist.genres)
      .reduce((acc, genre) => {
        acc[genre] = (acc[genre] || 0) + 1;
        return acc;
      }, {});

    // Sort genres by count and take top 5
    const topGenres = Object.entries(genreCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return new Response(
      JSON.stringify({
        features: avgFeatures,
        genres: topGenres,
        access_token: valid_token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
