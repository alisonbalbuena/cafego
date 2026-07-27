import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useStreakReminder } from '../hooks/useStreakReminder';
import { useStudyPlans } from '../hooks/useStudyPlans';
import { useStudyInvites } from '../hooks/useStudyInvites';
import { ActiveSessionProvider } from '../hooks/useActiveSession';
import { COLORS } from '../theme';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import CheckInScreen from '../screens/CheckInScreen';
import FriendsScreen from '../screens/FriendsScreen';
import RewardsScreen from '../screens/RewardsScreen';
import ClaimCafeScreen from '../screens/ClaimCafeScreen';
import CafeProfileScreen from '../screens/CafeProfileScreen';
import AddMenuPhotoScreen from '../screens/AddMenuPhotoScreen';
import MerchantDashboardScreen from '../screens/MerchantDashboardScreen';
import ManageAnnouncementsScreen from '../screens/ManageAnnouncementsScreen';
import ManageMenuScreen from '../screens/ManageMenuScreen';
import AdminScreen from '../screens/AdminScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import PetScreen from '../screens/PetScreen';
import StudyPlansScreen from '../screens/StudyPlansScreen';
import CreateStudyPlanScreen from '../screens/CreateStudyPlanScreen';
import StudyPlanDetailScreen from '../screens/StudyPlanDetailScreen';
import StudyInvitesScreen from '../screens/StudyInvitesScreen';
import CreateStudyInviteScreen from '../screens/CreateStudyInviteScreen';
import SwipeableTabScreen from '../components/SwipeableTabScreen';
import { ADMIN_EMAIL, SHOW_ADMIN_TAB, SHOW_LOYALTY_PROGRAM } from '../constants';

function withSwipe(Component: React.ComponentType<any>) {
  return function SwipeWrapped(props: any) {
    return (
      <SwipeableTabScreen>
        <Component {...props} />
      </SwipeableTabScreen>
    );
  };
}

const AuthStack = createNativeStackNavigator();
const MainTabs = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const StudyStack = createNativeStackNavigator();
const FriendsStack = createNativeStackNavigator();
const RewardsStack = createNativeStackNavigator();
const MyCafeStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={withSwipe(HomeScreen)} />
      <HomeStack.Screen name="CafeProfile" component={CafeProfileScreen} />
      <HomeStack.Screen name="AddMenuPhoto" component={AddMenuPhotoScreen} />
      <HomeStack.Screen name="Map" component={MapScreen} />
    </HomeStack.Navigator>
  );
}

function StudyNavigator() {
  return (
    <StudyStack.Navigator screenOptions={{ headerShown: false }}>
      <StudyStack.Screen name="StudyMain" component={withSwipe(CheckInScreen)} />
      <StudyStack.Screen name="CafeProfile" component={CafeProfileScreen} />
      <StudyStack.Screen name="AddMenuPhoto" component={AddMenuPhotoScreen} />
    </StudyStack.Navigator>
  );
}

function FriendsNavigator() {
  return (
    <FriendsStack.Navigator screenOptions={{ headerShown: false }}>
      <FriendsStack.Screen name="FriendsMain" component={withSwipe(FriendsScreen)} />
      <FriendsStack.Screen name="StudyPlans" component={StudyPlansScreen} />
      <FriendsStack.Screen name="CreateStudyPlan" component={CreateStudyPlanScreen} />
      <FriendsStack.Screen name="StudyPlanDetail" component={StudyPlanDetailScreen} />
      <FriendsStack.Screen name="StudyInvites" component={StudyInvitesScreen} />
      <FriendsStack.Screen name="CreateStudyInvite" component={CreateStudyInviteScreen} />
    </FriendsStack.Navigator>
  );
}

function RewardsNavigator() {
  return (
    <RewardsStack.Navigator screenOptions={{ headerShown: false }}>
      <RewardsStack.Screen name="RewardsHome" component={withSwipe(RewardsScreen)} />
      <RewardsStack.Screen name="ClaimCafe" component={ClaimCafeScreen} />
    </RewardsStack.Navigator>
  );
}

function MyCafeNavigator() {
  return (
    <MyCafeStack.Navigator screenOptions={{ headerShown: false }}>
      <MyCafeStack.Screen name="MyCafeHome" component={withSwipe(MerchantDashboardScreen)} />
      <MyCafeStack.Screen name="ManageAnnouncements" component={ManageAnnouncementsScreen} />
      <MyCafeStack.Screen name="ManageMenu" component={ManageMenuScreen} />
    </MyCafeStack.Navigator>
  );
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileHome" component={withSwipe(ProfileScreen)} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
    </ProfileStack.Navigator>
  );
}

const TAB_ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ['home', 'home-outline'],
  Study: ['book', 'book-outline'],
  Friends: ['people', 'people-outline'],
  Rewards: ['gift', 'gift-outline'],
  'My Cafe': ['cafe', 'cafe-outline'],
  Coffee: ['happy', 'happy-outline'],
  Admin: ['shield-checkmark', 'shield-checkmark-outline'],
  Profile: ['person-circle', 'person-circle-outline'],
};

function MainNavigator() {
  const { user, profile } = useAuth();
  useStreakReminder(profile);
  useStudyPlans(user?.uid);
  useStudyInvites(user?.uid);
  const isMerchant = profile?.role === 'merchant' && !!profile.merchantCafeId;
  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <MainTabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textFaint,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 84,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const [filled, outline] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? filled : outline} size={size} color={color} />;
        },
      })}
    >
      <MainTabs.Screen name="Home" component={HomeNavigator} />
      <MainTabs.Screen name="Study" component={StudyNavigator} />
      <MainTabs.Screen name="Friends" component={FriendsNavigator} />
      {SHOW_LOYALTY_PROGRAM && <MainTabs.Screen name="Rewards" component={RewardsNavigator} />}
      {SHOW_LOYALTY_PROGRAM && isMerchant && (
        <MainTabs.Screen name="My Cafe" component={MyCafeNavigator} />
      )}
      <MainTabs.Screen name="Coffee" component={withSwipe(PetScreen)} />
      {SHOW_ADMIN_TAB && isAdmin && (
        <MainTabs.Screen name="Admin" component={withSwipe(AdminScreen)} />
      )}
      <MainTabs.Screen name="Profile" component={ProfileNavigator} />
    </MainTabs.Navigator>
  );
}

export default function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <ActiveSessionProvider>
          <MainNavigator />
        </ActiveSessionProvider>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
