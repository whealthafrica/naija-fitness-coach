import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'modules/onboarding/onboarding_view.dart';
import 'services/supabase_client.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Supabase. Requires --dart-define parameters on run.
  await SupabaseService.initialize();

  runApp(const NaijaFitnessCoachApp());
}

class NaijaFitnessCoachApp extends StatelessWidget {
  const NaijaFitnessCoachApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Naija Fitness Coach',
      theme: ThemeData(
        scaffoldBackgroundColor: AppColors.warmCream,
        colorScheme: ColorScheme.fromSeed(seedColor: AppColors.deepBurgundy),
        useMaterial3: true,
      ),
      home: const OnboardingView(),
    );
  }
}
