import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../hooks/useAuth';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import HomeScreen from '../screens/HomeScreen';
import CheckInScreen from '../screens/CheckInScreen';
import FriendsScreen from '../screens/FriendsScreen';
import RewardsScreen from '../screens/RewardsScreen';
import ClaimCafeScreen from '../screens/ClaimCafeScreen';
import CafeProfileScreen from '../screens/CafeProfileScreen';
import MerchantDashboardScreen from '../screens/MerchantDashboardScreen';
import ManageAnnouncementsScreen from '../screens/ManageAnnouncementsScreen';
import ManageMenuScreen from '../screens/ManageMenuScreen';

const AuthStack = createNativeStackNavigator();
const MainTabs = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const RewardsStack = createNativeStackNavigator();
const MyCafeStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="CafeProfile" component={CafeProfileScreen} />
    </HomeStack.Navigator>
  );
}

function RewardsNavigator() {
  return (
    <RewardsStack.Navigator screenOptions={{ headerShown: false }}>
      <RewardsStack.Screen name="RewardsHome" component={RewardsScreen} />
      <RewardsStack.Screen name="ClaimCafe" component={ClaimCafeScreen} />
      <RewardsStack.Screen name="CafeProfile" component={CafeProfileScreen} />
    </RewardsStack.Navigator>
  );
}

function MyCafeNavigator() {
  return (
    <MyCafeStack.Navigator screenOptions={{ headerShown: false }}>
      <MyCafeStack.Screen name="MyCafeHome" component={MerchantDashboardScreen} />
      <MyCafeStack.Screen name="ManageAnnouncements" component={ManageAnnouncementsScreen} />
      <MyCafeStack.Screen name="ManageMenu" component={ManageMenuScreen} />
    </MyCafeStack.Navigator>
  );
}

function MainNavigator() {
  const { profile } = useAuth();
  const isMerchant = profile?.role === 'merchant' && !!profile.merchantCafeId;

  return (
    <MainTabs.Navigator screenOptions={{ headerShown: false }}>
      <MainTabs.Screen name="Home" component={HomeNavigator} />
      <MainTabs.Screen name="Study" component={CheckInScreen} />
      <MainTabs.Screen name="Friends" component={FriendsScreen} />
      <MainTabs.Screen name="Rewards" component={RewardsNavigator} />
      {isMerchant && <MainTabs.Screen name="My Cafe" component={MyCafeNavigator} />}
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
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
