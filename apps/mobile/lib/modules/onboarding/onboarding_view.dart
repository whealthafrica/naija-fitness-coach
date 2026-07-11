import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../services/auth_service.dart';

class OnboardingView extends StatefulWidget {
  const OnboardingView({super.key});

  @override
  State<OnboardingView> createState() => _OnboardingViewState();
}

class _OnboardingViewState extends State<OnboardingView> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  
  String? _selectedTier;
  String? _selectedCondition;
  bool _isLoading = false;

  final List<Map<String, dynamic>> _tiers = [
    {'id': 'basic', 'name': 'Basic', 'price': '₦30,000'},
    {'id': 'standard', 'name': 'Standard', 'price': '₦60,000'},
    {'id': 'premium', 'name': 'Premium', 'price': '₦100,000'},
  ];

  final List<String> _conditions = [
    'type_2_diabetes',
    'hypertension',
    'pcos',
    'obesity',
    'general_fitness'
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _selectedTier == null || _selectedCondition == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all fields and selections')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final authService = AuthService();
      await authService.signUp(
        _emailController.text.trim(),
        _passwordController.text.trim(),
        _nameController.text.trim(),
      );
      
      // TODO: Proceed to Paystack Checkout and Client Profile creation
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Account created! Proceeding to payment...')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.warmCream,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: AppSpacing.xl),
                Text(
                  'Welcome to Naija Fitness Coach',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: AppColors.warmNearBlack,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.md),
                
                // Account Info
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Full Name',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v!.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _emailController,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => v!.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _passwordController,
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    border: OutlineInputBorder(),
                  ),
                  obscureText: true,
                  validator: (v) => v!.length < 6 ? 'Too short' : null,
                ),
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _phoneController,
                  decoration: const InputDecoration(
                    labelText: 'Phone Number',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.phone,
                  validator: (v) => v!.isEmpty ? 'Required' : null,
                ),
                
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Select Your Condition',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<String>(
                  value: _selectedCondition,
                  decoration: const InputDecoration(border: OutlineInputBorder()),
                  items: _conditions.map((c) => DropdownMenuItem(
                    value: c,
                    child: Text(c.replaceAll('_', ' ').toUpperCase()),
                  )).toList(),
                  onChanged: (v) => setState(() => _selectedCondition = v),
                ),

                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Choose Your Tier',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                ..._tiers.map((tier) => RadioListTile<String>(
                  title: Text('${tier['name']} - ${tier['price']}'),
                  value: tier['id'],
                  groupValue: _selectedTier,
                  activeColor: AppColors.deepBurgundy,
                  onChanged: (v) => setState(() => _selectedTier = v),
                )),
                
                const SizedBox(height: AppSpacing.xl),
                ElevatedButton(
                  onPressed: _isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.deepBurgundy,
                    foregroundColor: AppColors.onPrimaryWhite,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.input),
                    ),
                  ),
                  child: _isLoading 
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text(
                        'Continue to Payment',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                ),
                const SizedBox(height: AppSpacing.xl),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
