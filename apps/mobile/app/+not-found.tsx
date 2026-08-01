import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/lib/auth";
import { colors } from "../src/theme";

/**
 * Deep links from Expo Go (exp://host:port/--/) and stale navigation state can
 * resolve to a path the router doesn't know. Send those back into the app
 * instead of showing the default unmatched-route screen.
 */
export default function NotFound() {
  const { ready, token } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.crimson} />
      </View>
    );
  }

  return <Redirect href={token ? "/(tabs)" : "/signin"} />;
}
