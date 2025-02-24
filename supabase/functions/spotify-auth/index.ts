
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

    // Get the request URL to determine the environment
    const url = new URL(req.url);
    const origin = url.searchParams.get('origin') || req.headers.get('origin');
    console.log('Origin from request:', origin);

    if (!origin) {
      throw new Error('No origin provided');
    }

    // Construct the exact redirect URI
    const redirectUri = `${origin}/callback`;
    console.log('Using redirect URI:', redirectUri);

    if (!code) {
      // Generate the Spotify authorization URL
      const scopes = [
        'user-read-private',
        'user-read-email',
        'user-top-read',
        'user-library-read'
      ];

      const authUrl = new URL('https://accounts.spotify.com/authorize')
      authUrl.searchParams.append('client_id', SPOTIFY_CLIENT_ID)
      authUrl.searchParams.append('response_type', 'code')
      authUrl.searchParams.append('redirect_uri', redirectUri)
      authUrl.searchParams.append('scope', scopes.join(' '))
      authUrl.searchParams.append('show_dialog', 'true') // Force showing the auth dialog

      console.log('Generated auth URL:', authUrl.toString())

      return new Response(
        JSON.stringify({ url: authUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Received code, exchanging for token...')

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
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Spotify token error:', errorData)
      throw new Error('Failed to get Spotify access token')
    }

    const tokenData: SpotifyTokenResponse = await tokenResponse.json()
    console.log('Successfully obtained token')

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
