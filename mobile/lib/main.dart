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


const canvas = Color(0xFFF7F9FA);
const navy = Color(0xFF0C2635);

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});
  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  final search = TextEditingController();
  String? country;
  String selectedType = 'All';
  int tab = 0;
  late Future<List<Map<String, dynamic>>> listings;
  static const types = ['All','Motorboat','Sailboat','Catamaran','Jetski'];

  @override
  void initState() { super.initState(); refresh(); }
  @override
  void dispose() { search.dispose(); super.dispose(); }

  void refresh() {
    setState(() {
      var request = Supabase.instance.client.from('boats').select(
        'id,name,country,location,type,photo_url,guests,price'
      ).eq('published', true);
      if (country != null) request = request.eq('country', country!);
      listings = request.order('created_at', ascending: false).limit(100)
        .then((items) => items.where((boat) {
          final haystack = (boat['name'].toString() + ' ' +
            boat['location'].toString() + ' ' + boat['type'].toString())
              .toLowerCase();
          final typeMatches = selectedType == 'All' ||
            boat['type'].toString().toLowerCase().contains(selectedType.toLowerCase());
          return typeMatches && haystack.contains(search.text.trim().toLowerCase());
        }).toList());
    });
  }

  void openAccount() => Navigator.push(context,
    MaterialPageRoute(builder: (_) => const AccountScreen()));

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: canvas,
    body: SafeArea(
      child: tab == 0 || tab == 1 ? _explore() : _placeholderTab(),
    ),
    bottomNavigationBar: NavigationBar(
      height: 72,
      backgroundColor: Colors.white,
      indicatorColor: const Color(0xFFDDF2F4),
      selectedIndex: tab,
      destinations: const [
        NavigationDestination(icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
        NavigationDestination(icon: Icon(Icons.search_rounded), label: 'Explore'),
        NavigationDestination(icon: Icon(Icons.favorite_border_rounded), label: 'Saved'),
        NavigationDestination(icon: Icon(Icons.calendar_month_outlined), label: 'Trips'),
        NavigationDestination(icon: Icon(Icons.person_outline_rounded), label: 'Account'),
      ],
      onDestinationSelected: (index) {
        if (index == 4) { openAccount(); return; }
        setState(() => tab = index);
      },
    ),
  );

  Widget _explore() => RefreshIndicator(
    onRefresh: () async { refresh(); await listings; },
    child: ListView(
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(22, 18, 22, 16),
          child: Row(children: [
            Container(width: 40, height: 40,
              decoration: BoxDecoration(color: navy,
                borderRadius: BorderRadius.circular(14)),
              child: const Icon(Icons.sailing_rounded, color: Colors.white)),
            const SizedBox(width: 11),
            const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('GET BY BOAT', style: TextStyle(color: navy,
                  fontSize: 16, letterSpacing: 1.4, fontWeight: FontWeight.w900)),
                Text('The sea is calling.', style: TextStyle(color: Color(0xFF7C919B),
                  fontSize: 12)),
              ])),
            InkWell(
              onTap: openAccount,
              borderRadius: BorderRadius.circular(22),
              child: Container(width: 42, height: 42,
                decoration: BoxDecoration(color: Colors.white,
                  shape: BoxShape.circle, border: Border.all(color: Color(0xFFE3ECF0))),
                child: const Icon(Icons.person_outline_rounded, color: navy)),
            ),
          ]),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          height: 244,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            gradient: const LinearGradient(
              begin: Alignment.topLeft, end: Alignment.bottomRight,
              colors: [Color(0xFF0B3851), Color(0xFF087D9C), Color(0xFF38C0BD)])),
          child: Stack(children: [
            Positioned(right: -32, top: -30, child: Icon(Icons.waves_rounded,
              size: 220, color: Colors.white.withValues(alpha: 0.09))),
            Positioned(right: 24, bottom: 22, child: Icon(Icons.sailing_rounded,
              color: Colors.white.withValues(alpha: 0.22), size: 98)),
            Padding(
              padding: const EdgeInsets.all(26),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(20)),
                  child: const Text('EXPLORE THE COAST',
                    style: TextStyle(fontSize: 10, color: Colors.white,
                      letterSpacing: 1.6, fontWeight: FontWeight.w800))),
                const Spacer(),
                const Text('Not just boating.\nA feeling.',
                  style: TextStyle(color: Colors.white,
                    fontSize: 32, height: 1.04, fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                const Text('Find your kind of paradise.',
                  style: TextStyle(color: Colors.white, fontSize: 14)),
              ]),
            ),
          ]),
        ),
        Padding(padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Where to?', style: TextStyle(
              fontSize: 24, fontWeight: FontWeight.w800, color: navy)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                boxShadow: const [BoxShadow(color: Color(0x0B0C2635),
                  blurRadius: 18, offset: Offset(0, 5))]),
              child: TextField(
                controller: search,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) { tab = 1; refresh(); },
                decoration: InputDecoration(
                  border: InputBorder.none,
                  icon: const Icon(Icons.search, color: ocean, size: 25),
                  hintText: 'City, destination or boat',
                  hintStyle: const TextStyle(color: Color(0xFF8196A1)),
                  suffixIcon: IconButton(
                    tooltip: 'Search',
                    icon: const Icon(Icons.arrow_forward_rounded, color: navy),
                    onPressed: () { tab = 1; refresh(); }),
                ),
              ),
            ),
            const SizedBox(height: 13),
            InkWell(
              onTap: _pickCountry,
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
                decoration: BoxDecoration(color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEBF0F3))),
                child: Row(children: [
                  const Icon(Icons.place_outlined, color: ocean),
                  const SizedBox(width: 10),
                  Expanded(child: Text(country ?? 'All destinations',
                    style: const TextStyle(color: navy, fontWeight: FontWeight.w600))),
                  const Icon(Icons.keyboard_arrow_down_rounded, color: navy),
                ]),
              ),
            ),
            const SizedBox(height: 25),
            const Row(children: [
              Expanded(child: Text('Find your escape',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: navy))),
              Text('14 countries', style: TextStyle(color: Color(0xFF7C919B),
                fontSize: 12)),
            ]),
            const SizedBox(height: 13),
          ]),
        ),
        SizedBox(
          height: 47,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            children: types.map((kind) {
              final chosen = selectedType == kind;
              return Padding(padding: const EdgeInsets.only(right: 9),
                child: ChoiceChip(
                  label: Text(kind),
                  selected: chosen,
                  selectedColor: navy,
                  backgroundColor: Colors.white,
                  labelStyle: TextStyle(color: chosen ? Colors.white : navy,
                    fontWeight: FontWeight.w600),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22),
                    side: BorderSide(color: chosen ? navy : const Color(0xFFE1EBEF))),
                  showCheckmark: false,
                  onSelected: (_) { selectedType = kind; refresh(); },
                ));
            }).toList(),
          ),
        ),
        Padding(padding: const EdgeInsets.fromLTRB(20, 23, 20, 12),
          child: Row(children: [
            const Expanded(child: Text('Boats you’ll love',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: navy))),
            InkWell(onTap: () { setState(() => tab = 1); refresh(); },
              child: const Text('See all', style: TextStyle(
                color: ocean, fontWeight: FontWeight.w700))),
          ])),
        FutureBuilder<List<Map<String, dynamic>>>(
          future: listings,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Padding(padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()));
            }
            if (snapshot.hasError) {
              return _notice('Could not load boats', 'Check your connection and try again.',
                Icons.wifi_off_rounded);
            }
            final items = snapshot.data ?? [];
            if (items.isEmpty) return _notice('Your next escape is coming',
              'New boats will appear here as soon as owners publish them.',
              Icons.sailing_rounded);
            return Column(children: items.map((boat) => Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: _boatCard(boat),
            )).toList());
          },
        ),
      ],
    ),
  );

  Widget _boatCard(Map<String,dynamic> boat) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(23),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: () => Navigator.push(context,
        MaterialPageRoute(builder: (_) => BoatScreen(boat: boat))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Stack(children: [
          SizedBox(height: 205, width: double.infinity,
            child: boat['photo_url'] is String &&
              (boat['photo_url'] as String).startsWith('https://')
              ? Image.network(boat['photo_url'] as String, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const BoatPlaceholder())
              : const BoatPlaceholder()),
          Positioned(top: 13, left: 13,
            child: Container(padding: const EdgeInsets.symmetric(
              horizontal: 11, vertical: 7),
              decoration: BoxDecoration(color: Colors.white,
                borderRadius: BorderRadius.circular(12)),
              child: const Text('UPON REQUEST', style: TextStyle(
                fontSize: 10, color: navy, letterSpacing: 0.8,
                fontWeight: FontWeight.w800)))),
        ]),
        Padding(padding: const EdgeInsets.all(17), child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text(boat['name'].toString(),
                maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 19,
                  color: navy, fontWeight: FontWeight.w800))),
              const Icon(Icons.arrow_outward_rounded, color: ocean, size: 20),
            ]),
            const SizedBox(height: 6),
            Row(children: [
              const Icon(Icons.location_on_outlined, size: 16,
                color: Color(0xFF79909E)),
              const SizedBox(width: 3),
              Expanded(child: Text(boat['location'].toString() + ', ' +
                boat['country'].toString(), maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Color(0xFF79909E), fontSize: 13))),
            ]),
            const SizedBox(height: 13),
            Row(children: [
              const Icon(Icons.directions_boat_outlined,
                color: ocean, size: 17),
              const SizedBox(width: 5),
              Text(boat['type'].toString(),
                style: const TextStyle(color: navy, fontSize: 12)),
              const SizedBox(width: 16),
              const Icon(Icons.people_outline_rounded, color: ocean, size: 17),
              const SizedBox(width: 5),
              Text(boat['guests'].toString() + ' guests',
                style: const TextStyle(color: navy, fontSize: 12)),
              const Spacer(),
              Text('€' + boat['price'].toString() + ' / day',
                style: const TextStyle(color: navy, fontWeight: FontWeight.w800)),
            ]),
          ],
        )),
      ]),
    ),
  );

  Widget _notice(String title, String message, IconData symbol) => Container(
    margin: const EdgeInsets.symmetric(horizontal: 20),
    padding: const EdgeInsets.all(30),
    decoration: BoxDecoration(color: Colors.white,
      borderRadius: BorderRadius.circular(22)),
    child: Column(children: [
      Icon(symbol, color: ocean, size: 44),
      const SizedBox(height: 14),
      Text(title, textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      Text(message, textAlign: TextAlign.center,
        style: const TextStyle(color: Color(0xFF718997))),
      const SizedBox(height: 12),
      TextButton(onPressed: refresh, child: const Text('Refresh')),
    ]),
  );

  Widget _placeholderTab() => Center(
    child: Padding(padding: const EdgeInsets.all(28),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(tab == 2 ? Icons.favorite_border_rounded :
          Icons.calendar_month_outlined, size: 54, color: ocean),
        const SizedBox(height: 18),
        Text(tab == 2 ? 'Saved boats' : 'Your trips',
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 9),
        Text(tab == 2
          ? 'Save boats you love when favourites are connected.'
          : 'Your booking requests will appear here in a coming update.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(0xFF718997))),
        const SizedBox(height: 19),
        OutlinedButton(onPressed: () => setState(() => tab = 1),
          child: const Text('Explore boats')),
      ]),
    ),
  );

  Future<void> _pickCountry() async {
    final value = await showModalBottomSheet<String>(
      context: context, isScrollControlled: true,
      showDragHandle: true, backgroundColor: Colors.white,
      builder: (context) => SafeArea(child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.65,
        child: Column(children: [
          const Padding(padding: EdgeInsets.all(18),
            child: Text('Choose a destination',
              style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800))),
          Expanded(child: ListView(children: [
            ListTile(title: const Text('All destinations'),
              onTap: () => Navigator.pop(context, 'ALL')),
            ...countries.map((value) => ListTile(
              title: Text(value),
              trailing: const Icon(Icons.arrow_forward_ios, size: 13),
              onTap: () => Navigator.pop(context, value))),
          ])),
        ]),
      )),
    );
    if (value != null) {
      country = value == 'ALL' ? null : value;
      refresh();
    }
  }
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
