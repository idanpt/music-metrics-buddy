
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID')
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET')

async function refreshAccessToken(refresh_token: string) {
  try {
    console.log('Attempting to refresh access token...')
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
    if (!response.ok) {
      console.error('Token refresh failed:', data)
      throw new Error(`Token refresh failed: ${data.error}`)
    }
    
    console.log('Successfully refreshed access token')
    return data.access_token
  } catch (error) {
    console.error('Error refreshing token:', error)
    throw error
  }
}

async function fetchWithRetry(url: string, options: RequestInit, refresh_token: string) {
  try {
    const response = await fetch(url, options)
    const data = await response.json()

    if (response.status === 401 || response.status === 403) {
      console.log(`Token expired, refreshing... (${response.status} error)`)
      const new_token = await refreshAccessToken(refresh_token)
      
      // Retry with new token
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${new_token}`
      }
      
      const retryResponse = await fetch(url, options)
      const retryData = await retryResponse.json()
      
      if (!retryResponse.ok) {
        throw new Error(`Request failed after token refresh: ${JSON.stringify(retryData)}`)
      }
      
      return { data: retryData, new_token }
    }

    if (!response.ok) {
      throw new Error(`Request failed: ${JSON.stringify(data)}`)
    }

    return { data }
  } catch (error) {
    console.error(`Error fetching ${url}:`, error)
    throw error
  }
}

async function fetchTopTracks(access_token: string, refresh_token: string) {
  console.log('Fetching top tracks...')
  const { data, new_token } = await fetchWithRetry(
    'https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=short_term',
    {
      headers: { 'Authorization': `Bearer ${access_token}` }
    },
    refresh_token
  )
  
  if (!data.items || !Array.isArray(data.items)) {
    console.error('Unexpected top tracks response format:', data)
    throw new Error('Invalid response format from Spotify API')
  }
  
  console.log(`Successfully fetched ${data.items.length} top tracks`)
  return { tracks: data, new_token }
}

async function fetchAudioFeatures(access_token: string, refresh_token: string, trackIds: string[]) {
  if (!trackIds.length) {
    console.error('No track IDs provided for audio features')
    throw new Error('No track IDs provided')
  }

  console.log(`Fetching audio features for ${trackIds.length} tracks...`)
  const { data, new_token } = await fetchWithRetry(
    `https://api.spotify.com/v1/audio-features?ids=${trackIds.join(',')}`,
    {
      headers: { 'Authorization': `Bearer ${access_token}` }
    },
    refresh_token
  )
  
  if (!data.audio_features || !Array.isArray(data.audio_features)) {
    console.error('Unexpected audio features response format:', data)
    throw new Error('Invalid response format from Spotify API')
  }
  
  console.log(`Successfully fetched audio features for ${data.audio_features.length} tracks`)
  return { features: data, new_token }
}

async function fetchArtists(access_token: string, refresh_token: string, artistIds: string[]) {
  if (!artistIds.length) {
    console.error('No artist IDs provided')
    throw new Error('No artist IDs provided')
  }

  console.log(`Fetching ${artistIds.length} artists...`)
  const { data, new_token } = await fetchWithRetry(
    `https://api.spotify.com/v1/artists?ids=${artistIds.join(',')}`,
    {
      headers: { 'Authorization': `Bearer ${access_token}` }
    },
    refresh_token
  )
  
  if (!data.artists || !Array.isArray(data.artists)) {
    console.error('Unexpected artists response format:', data)
    throw new Error('Invalid response format from Spotify API')
  }
  
  console.log(`Successfully fetched ${data.artists.length} artists`)
  return { artists: data, new_token }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { access_token, refresh_token } = await req.json()
    console.log('Received request with tokens')
    
    if (!access_token || !refresh_token) {
      throw new Error('Missing tokens')
    }

    let currentToken = access_token
    
    // Fetch all data with potential token refresh
    console.log('Attempting to fetch data...')
    
    // 1. Fetch top tracks
    const { tracks, new_token: new_token1 } = await fetchTopTracks(currentToken, refresh_token)
    if (new_token1) currentToken = new_token1
    
    // Get unique artist IDs
    const artistIds = [...new Set(tracks.items.flatMap(track => 
      track.artists.map(artist => artist.id)
    ))].slice(0, 50)

    // 2. Fetch audio features
    const { features, new_token: new_token2 } = await fetchAudioFeatures(
      currentToken,
      refresh_token,
      tracks.items.map(track => track.id)
    )
    if (new_token2) currentToken = new_token2

    // 3. Fetch artists
    const { artists, new_token: new_token3 } = await fetchArtists(currentToken, refresh_token, artistIds)
    if (new_token3) currentToken = new_token3

    // Calculate average audio features
    const avgFeatures = features.audio_features.reduce((acc, feat) => {
      if (!feat) return acc
      Object.keys(feat).forEach(key => {
        if (typeof feat[key] === 'number' && key !== 'duration_ms' && key !== 'time_signature') {
          acc[key] = (acc[key] || 0) + feat[key]
        }
      })
      return acc
    }, {})

    const validFeatures = features.audio_features.filter(f => f)
    Object.keys(avgFeatures).forEach(key => {
      avgFeatures[key] /= validFeatures.length
    })

    // Count genres
    const genreCounts = artists.artists.flatMap(artist => artist.genres)
      .reduce((acc, genre) => {
        acc[genre] = (acc[genre] || 0) + 1
        return acc
      }, {})

    // Sort genres by count and take top 5
    const topGenres = Object.entries(genreCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    console.log('Successfully processed all data')
    return new Response(
      JSON.stringify({
        features: avgFeatures,
        genres: topGenres,
        access_token: currentToken !== access_token ? currentToken : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in edge function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        details: error.toString()
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
