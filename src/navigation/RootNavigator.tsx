import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../hooks/useAuth';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import CheckInScreen from '../screens/CheckInScreen';
import FriendsScreen from '../screens/FriendsScreen';
import RewardsScreen from '../screens/RewardsScreen';
import ClaimCafeScreen from '../screens/ClaimCafeScreen';
import MerchantDashboardScreen from '../screens/MerchantDashboardScreen';

const AuthStack = createNativeStackNavigator();
const MainTabs = createBottomTabNavigator();
const RewardsStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function RewardsNavigator() {
  return (
    <RewardsStack.Navigator screenOptions={{ headerShown: false }}>
      <RewardsStack.Screen name="RewardsHome" component={RewardsScreen} />
      <RewardsStack.Screen name="ClaimCafe" component={ClaimCafeScreen} />
    </RewardsStack.Navigator>
  );
}

function MainNavigator() {
  const { profile } = useAuth();
  const isMerchant = profile?.role === 'merchant' && !!profile.merchantCafeId;

  return (
    <MainTabs.Navigator screenOptions={{ headerShown: false }}>
      <MainTabs.Screen name="Study" component={CheckInScreen} />
      <MainTabs.Screen name="Friends" component={FriendsScreen} />
      <MainTabs.Screen name="Rewards" component={RewardsNavigator} />
      {isMerchant && <MainTabs.Screen name="My Cafe" component={MerchantDashboardScreen} />}
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
