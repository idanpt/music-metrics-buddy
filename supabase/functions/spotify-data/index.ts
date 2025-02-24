
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

async function fetchTopTracks(access_token: string) {
  try {
    console.log('Fetching top tracks...')
    const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })
    
    const data = await response.json()
    if (!response.ok) {
      console.error('Failed to fetch top tracks:', data)
      throw new Error(`Failed to fetch top tracks: ${data.error?.message || 'Unknown error'}`)
    }
    
    console.log('Successfully fetched top tracks')
    return data
  } catch (error) {
    console.error('Error fetching top tracks:', error)
    throw error
  }
}

async function fetchAudioFeatures(access_token: string, trackIds: string[]) {
  try {
    console.log('Fetching audio features...')
    const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds.join(',')}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })
    
    const data = await response.json()
    if (!response.ok) {
      console.error('Failed to fetch audio features:', data)
      throw new Error(`Failed to fetch audio features: ${data.error?.message || 'Unknown error'}`)
    }
    
    console.log('Successfully fetched audio features')
    return data
  } catch (error) {
    console.error('Error fetching audio features:', error)
    throw error
  }
}

async function fetchArtists(access_token: string, artistIds: string[]) {
  try {
    console.log('Fetching artists...')
    const response = await fetch(`https://api.spotify.com/v1/artists?ids=${artistIds.join(',')}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })
    
    const data = await response.json()
    if (!response.ok) {
      console.error('Failed to fetch artists:', data)
      throw new Error(`Failed to fetch artists: ${data.error?.message || 'Unknown error'}`)
    }
    
    console.log('Successfully fetched artists')
    return data
  } catch (error) {
    console.error('Error fetching artists:', error)
    throw error
  }
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

    // First try with the provided access token
    try {
      console.log('Attempting to fetch data with provided access token...')
      // Fetch top tracks
      const topTracks = await fetchTopTracks(access_token)

      // Get unique artist IDs
      const artistIds = [...new Set(topTracks.items.flatMap(track => 
        track.artists.map(artist => artist.id)
      ))].slice(0, 50)

      // Fetch audio features
      const audioFeatures = await fetchAudioFeatures(
        access_token, 
        topTracks.items.map(track => track.id)
      )

      // Fetch artists
      const artists = await fetchArtists(access_token, artistIds)

      // Calculate average audio features
      const avgFeatures = audioFeatures.audio_features.reduce((acc, feat) => {
        if (!feat) return acc
        Object.keys(feat).forEach(key => {
          if (typeof feat[key] === 'number' && key !== 'duration_ms' && key !== 'time_signature') {
            acc[key] = (acc[key] || 0) + feat[key]
          }
        })
        return acc
      }, {})

      Object.keys(avgFeatures).forEach(key => {
        avgFeatures[key] /= audioFeatures.audio_features.filter(f => f).length
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

      return new Response(
        JSON.stringify({
          features: avgFeatures,
          genres: topGenres,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.log('Initial request failed, attempting token refresh...')
      // If the initial request fails, try refreshing the token
      const new_access_token = await refreshAccessToken(refresh_token)
      
      // Retry the request with the new token
      const topTracks = await fetchTopTracks(new_access_token)

      const artistIds = [...new Set(topTracks.items.flatMap(track => 
        track.artists.map(artist => artist.id)
      ))].slice(0, 50)

      const audioFeatures = await fetchAudioFeatures(
        new_access_token, 
        topTracks.items.map(track => track.id)
      )

      const artists = await fetchArtists(new_access_token, artistIds)

      const avgFeatures = audioFeatures.audio_features.reduce((acc, feat) => {
        if (!feat) return acc
        Object.keys(feat).forEach(key => {
          if (typeof feat[key] === 'number' && key !== 'duration_ms' && key !== 'time_signature') {
            acc[key] = (acc[key] || 0) + feat[key]
          }
        })
        return acc
      }, {})

      Object.keys(avgFeatures).forEach(key => {
        avgFeatures[key] /= audioFeatures.audio_features.filter(f => f).length
      })

      const genreCounts = artists.artists.flatMap(artist => artist.genres)
        .reduce((acc, genre) => {
          acc[genre] = (acc[genre] || 0) + 1
          return acc
        }, {})

      const topGenres = Object.entries(genreCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))

      return new Response(
        JSON.stringify({
          features: avgFeatures,
          genres: topGenres,
          access_token: new_access_token, // Include the new token in the response
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error in edge function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
