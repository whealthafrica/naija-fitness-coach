import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService {
  final _client = Supabase.instance.client;

  Future<AuthResponse> signUp(String email, String password, String fullName) async {
    final response = await _client.auth.signUp(email: email, password: password);
    if (response.user != null) {
      await _client.from('profiles').insert({
        'id': response.user!.id,
        'full_name': fullName,
        'role': 'client',
      });
    }
    return response;
  }

  Future<AuthResponse> signIn(String email, String password) =>
      _client.auth.signInWithPassword(email: email, password: password);

  Future<void> signOut() => _client.auth.signOut();
  User? get currentUser => _client.auth.currentUser;
}
