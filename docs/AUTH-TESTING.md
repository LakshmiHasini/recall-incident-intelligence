# Checking signed-out access

Build the app and start the local Worker with `npm run build` and `npm run start`. In a second terminal, run `npm run test:auth`.

The test checks that an anonymous workspace request redirects to the sign-in endpoint and that both reading and creating incidents through the API return 401. It only accepts a loopback Worker URL and does not use Hindsight credits. Stop the Worker after testing.

The local development server intentionally permits anonymous loopback access, so it is not suitable for this check. The local Worker test does not exercise the hosted identity provider. To check the deployed flow, sign in through the landing page, select **Sign out**, and open the workspace again to confirm that sign-in is requested.
