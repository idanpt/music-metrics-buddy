
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
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get Spotify credentials from Supabase secrets
    const { data: { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } } = await supabaseClient.functions.invoke('get-secrets', {
      body: { keys: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'] }
    })

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

    const tokenData: SpotifyTokenResponse = await tokenResponse.json()

    return new Response(
      JSON.stringify(tokenData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
