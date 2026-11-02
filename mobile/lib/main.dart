import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const ocean = Color(0xFF087A9E);
const countries = ['Croatia','Greece','Spain','France','Italy','Malta','Portugal','Cyprus','Montenegro','Turkey','Albania','Australia','Bahamas','United States'];

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: 'https://oufkqqrhjuspczarzjrr.supabase.co',
    anonKey: 'sb_publishable_ct8GK7tOL5jxvHsJqTOFtw_PBYSUe_E',
  );
  runApp(const GetByBoat());
}

class GetByBoat extends StatelessWidget {
  const GetByBoat({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Get By Boat',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: ocean),
      scaffoldBackgroundColor: const Color(0xFFF5FAFB)),
    home: const ExploreScreen(),
  );
}

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});
  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}
class _ExploreScreenState extends State<ExploreScreen> {
  final search = TextEditingController();
  String? country;
  late Future<List<Map<String,dynamic>>> listings;
  @override
  void initState() { super.initState(); refresh(); }
  void refresh() {
    setState(() {
      var request = Supabase.instance.client.from('boats').select(
        'id,name,country,location,type,photo_url,guests,price'
      ).eq('published', true);
      if (country != null) request = request.eq('country', country!);
      listings = request.order('created_at', ascending: false).limit(100)
        .then((items) => items.where((boat) =>
          (boat['name'].toString() + ' ' + boat['location'].toString() +
          ' ' + boat['type'].toString()).toLowerCase()
          .contains(search.text.trim().toLowerCase())).toList());
    });
  }
  @override
  void dispose() { search.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Get By Boat', style: TextStyle(fontWeight: FontWeight.bold)),
      actions: [IconButton(icon: const Icon(Icons.person_outline),
        onPressed: () => Navigator.push(context,
          MaterialPageRoute(builder: (_) => const AccountScreen())))],
    ),
    body: RefreshIndicator(
      onRefresh: () async { refresh(); await listings; },
      child: ListView(padding: const EdgeInsets.all(20), children: [
        Container(padding: const EdgeInsets.all(26),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(25),
            gradient: const LinearGradient(colors: [Color(0xFF075B86), Color(0xFF16ADC0)])),
          child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.sailing, color: Colors.white, size: 38),
            SizedBox(height: 24),
            Text('Your next holiday\nstarts at sea.',
              style: TextStyle(color: Colors.white, fontSize: 30,
                fontWeight: FontWeight.w800)),
            SizedBox(height: 12),
            Text('Discover your next day on the water.',
              style: TextStyle(color: Colors.white)),
          ]),
        ),
        const SizedBox(height: 20),
        TextField(controller: search, onSubmitted: (_) => refresh(),
          decoration: InputDecoration(hintText: 'Search a city or boat',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: IconButton(icon: const Icon(Icons.arrow_forward),
              onPressed: refresh), filled: true, fillColor: Colors.white)),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: country,
          decoration: const InputDecoration(labelText: 'Destination country',
            filled: true, fillColor: Colors.white),
          items: [const DropdownMenuItem<String>(value: null,
            child: Text('All destinations')),
            ...countries.map((name) => DropdownMenuItem(value: name,
              child: Text(name)))],
          onChanged: (value) { country = value; refresh(); }),
        const SizedBox(height: 25),
        const Text('Explore boats', style: TextStyle(fontSize: 23,
          fontWeight: FontWeight.bold)),
        const SizedBox(height: 15),
        FutureBuilder<List<Map<String,dynamic>>>(
          future: listings,
          builder: (context, snapshot) {
            if (!snapshot.hasData && !snapshot.hasError) {
              return const Center(child: Padding(padding: EdgeInsets.all(32),
                child: CircularProgressIndicator()));
            }
            if (snapshot.hasError) {
              return const ListTile(title: Text('Could not load boats'),
                subtitle: Text('Please check your connection and refresh.'));
            }
            final items = snapshot.data!;
            if (items.isEmpty) return const ListTile(
              leading: Icon(Icons.directions_boat, color: ocean),
              title: Text('No boats found yet'),
              subtitle: Text('Listings will appear when owners publish them.'));
            return Column(children: items.map((boat) => Card(
              clipBehavior: Clip.antiAlias,
              margin: const EdgeInsets.only(bottom: 15),
              child: InkWell(
                onTap: () => Navigator.push(context, MaterialPageRoute(
                  builder: (_) => BoatScreen(boat: boat))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(height: 190, width: double.infinity,
                      child: boat['photo_url'] is String &&
                        (boat['photo_url'] as String).startsWith('https://')
                        ? Image.network(boat['photo_url'] as String,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const BoatPlaceholder())
                        : const BoatPlaceholder()),
                    Padding(padding: const EdgeInsets.all(16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(boat['name'].toString(),
                            style: const TextStyle(fontSize: 20,
                              fontWeight: FontWeight.bold)),
                          Text(boat['location'].toString() + ', ' +
                            boat['country'].toString()),
                          Text(boat['type'].toString() + ' · ' +
                            boat['guests'].toString() + ' guests'),
                          const SizedBox(height: 8),
                          Text('From €' + boat['price'].toString() + ' / day',
                            style: const TextStyle(color: ocean,
                              fontWeight: FontWeight.bold)),
                        ])),
                  ])),
            )).toList());
          },
        ),
      ]),
    ),
  );
}

class BoatPlaceholder extends StatelessWidget {
  const BoatPlaceholder({super.key});
  @override
  Widget build(BuildContext context) => const ColoredBox(
    color: Color(0xFFDCEFF2),
    child: Center(child: Icon(Icons.sailing, color: ocean, size: 58)));
}
class BoatScreen extends StatelessWidget {
  final Map<String,dynamic> boat;
  const BoatScreen({super.key, required this.boat});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(boat['name'].toString())),
    body: ListView(padding: const EdgeInsets.all(24), children: [
      const SizedBox(height: 210, child: BoatPlaceholder()),
      const SizedBox(height: 20),
      Text(boat['name'].toString(),
        style: const TextStyle(fontSize: 27, fontWeight: FontWeight.bold)),
      Text(boat['location'].toString() + ', ' + boat['country'].toString()),
      const SizedBox(height: 16),
      Text(boat['type'].toString() + ' · Up to ' +
        boat['guests'].toString() + ' guests'),
      const SizedBox(height: 16),
      Text('From €' + boat['price'].toString() + ' / day',
        style: const TextStyle(fontSize: 22, color: ocean)),
      const SizedBox(height: 18),
      const Text('Booking requests will be enabled in a later milestone. '
        'Existing web booking remains unchanged.'),
    ]),
  );
}

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}
class _AccountScreenState extends State<AccountScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool signup = false, busy = false;
  String message = '';
  SupabaseClient get client => Supabase.instance.client;
  Future<void> submit() async {
    if (email.text.trim().isEmpty || password.text.length < 6) {
      setState(() => message = 'Enter an email and a password (6+ characters).');
      return;
    }
    setState(() { busy = true; message = ''; });
    try {
      if (signup) {
        await client.auth.signUp(email: email.text.trim(),
          password: password.text);
        if (mounted) setState(() =>
          message = 'Account created. Check email if confirmation is required.');
      } else {
        await client.auth.signInWithPassword(email: email.text.trim(),
          password: password.text);
        if (mounted) setState(() => message = 'Signed in successfully.');
      }
    } on AuthException catch (error) {
      if (mounted) setState(() => message = error.message);
    } catch (_) {
      if (mounted) setState(() => message = 'Unable to connect. Try again.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
  @override
  void dispose() { email.dispose(); password.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('My account')),
    body: ListView(padding: const EdgeInsets.all(24), children: [
      StreamBuilder<AuthState>(
        stream: client.auth.onAuthStateChange,
        builder: (context, snapshot) {
          final user = client.auth.currentUser;
          if (user != null) return Column(children: [
            const Icon(Icons.verified_user, size: 48, color: ocean),
            const SizedBox(height: 16),
            Text('Signed in as ' + (user.email ?? 'member')),
            const SizedBox(height: 16),
            FilledButton(onPressed: () async {
              await client.auth.signOut();
              if (mounted) setState(() {});
            }, child: const Text('Log out')),
          ]);
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(signup ? 'Create an account' : 'Welcome back',
                style: const TextStyle(fontSize: 27,
                  fontWeight: FontWeight.bold)),
              const SizedBox(height: 18),
              TextField(controller: email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email')),
              const SizedBox(height: 12),
              TextField(controller: password, obscureText: true,
                decoration: const InputDecoration(labelText: 'Password')),
              const SizedBox(height: 18),
              FilledButton(onPressed: busy ? null : submit,
                child: Text(busy ? 'Please wait…' :
                  signup ? 'Create account' : 'Log in')),
              TextButton(onPressed: () => setState(() {
                signup = !signup; message = '';
              }), child: Text(signup ? 'Already registered? Log in' :
                'New here? Create account')),
              if (message.isNotEmpty) Text(message),
            ]);
        },
      ),
    ]),
  );
}
