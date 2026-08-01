import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors, fonts } from "../../src/theme";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: "⌂",
    Pay: "⇄",
    Cards: "◇",
    More: "☰",
  };
  return (
    <Text style={{ fontSize: 16, color: focused ? colors.crimson : colors.muted }}>
      {icons[label] || "•"}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.crimson,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.sans, fontSize: 11 },
        tabBarStyle: {
          borderTopColor: colors.line,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: "Pay",
          tabBarLabel: "Pay",
          tabBarIcon: ({ focused }) => <TabIcon label="Pay" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: "Cards",
          tabBarIcon: ({ focused }) => <TabIcon label="Cards" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "More",
          tabBarIcon: ({ focused }) => <TabIcon label="More" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
