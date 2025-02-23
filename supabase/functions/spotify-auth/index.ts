
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { code } = await req.json().catch(() => ({}))

    // Get environment variables
    const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID')
    const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET')
    
    console.log('Client ID available:', !!SPOTIFY_CLIENT_ID)
    console.log('Client Secret available:', !!SPOTIFY_CLIENT_SECRET)

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      throw new Error('Missing Spotify credentials')
    }

    if (!code) {
      // Generate the Spotify authorization URL
      const scopes = [
        'user-read-private',
        'user-read-email',
        'user-top-read',
        'user-library-read'
      ]

      const authUrl = new URL('https://accounts.spotify.com/authorize')
      authUrl.searchParams.append('client_id', SPOTIFY_CLIENT_ID)
      authUrl.searchParams.append('response_type', 'code')
      authUrl.searchParams.append('redirect_uri', `${req.headers.get('origin')}/callback`)
      authUrl.searchParams.append('scope', scopes.join(' '))

      return new Response(
        JSON.stringify({ url: authUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Exchange the code for an access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${req.headers.get('origin')}/callback`,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Spotify token error:', errorData)
      throw new Error('Failed to get Spotify access token')
    }

    const tokenData: SpotifyTokenResponse = await tokenResponse.json()

    return new Response(
      JSON.stringify(tokenData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
