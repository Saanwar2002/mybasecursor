# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{pkgs}: {
  # Which nixpkgs channel to use.
  channel = "stable-24.11"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
    pkgs.zulu
  ];
  # Sets environment variables in the workspace
  env = {
    # Firebase Configuration - Replace these with your actual Firebase project values
    # Get these from Firebase Console > Project Settings > General > Your apps
    NEXT_PUBLIC_FIREBASE_API_KEY = "your-firebase-api-key-here";
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "your-project-id.firebaseapp.com";
    NEXT_PUBLIC_FIREBASE_PROJECT_ID = "your-project-id";
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "your-project-id.appspot.com";
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "your-messaging-sender-id";
    NEXT_PUBLIC_FIREBASE_APP_ID = "your-app-id";
    
    # Google Maps API Key (if needed for map functionality)
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "your-google-maps-api-key-here";
  };
  # This adds a file watcher to startup the firebase emulators. The emulators will only start if
  # a firebase.json file is written into the user's directory
  services.firebase.emulators = {
    detect = true;
    projectId = "demo-app";
    services = ["auth" "firestore"];
  };
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
    ];
    workspace = {
      onCreate = {
        default.openFiles = [
          "src/app/page.tsx"
        ];
      };
    };
    # Enable previews and customize configuration
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}