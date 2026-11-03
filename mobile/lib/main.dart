import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'data.dart';

const ocean = Color(0xFF057F91);
const navy = Color(0xFF123A50);
const mist = Color(0xFFF2F8FA);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: supabaseUrl, anonKey: supabasePublishableKey);
  runApp(const GetByBoatApp());
}

Future<void> openWebsite(BuildContext context, String path) async {
  final uri = Uri.parse('https://getbyboat.net/#/' + path);
  if (!await launchUrl(uri, mode: LaunchMode.externalApplication) && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Unable to open the website. Please try again.')),
    );
  }
}

class GetByBoatApp extends StatelessWidget {
  const GetByBoatApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Get By Boat',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: ocean),
      scaffoldBackgroundColor: mist,
      appBarTheme: const AppBarTheme(
        backgroundColor: mist,
        foregroundColor: navy,
        centerTitle: false,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          side: const BorderSide(color: Color(0xFFE4EEF1)),
          borderRadius: BorderRadius.circular(19),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(15),
          borderSide: const BorderSide(color: Color(0xFFD8E7EB)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(15),
          borderSide: const BorderSide(color: Color(0xFFD8E7EB)),
        ),
      ),
    ),
    home: const MainTabs(),
  );
}

class MainTabs extends StatefulWidget {
  const MainTabs({super.key});
  @override
  State<MainTabs> createState() => _MainTabsState();
}

class _MainTabsState extends State<MainTabs> {
  int tab = 0;
  @override
  Widget build(BuildContext context) {
    final screens = <Widget>[
      const ExplorePage(),
      const SavedPage(),
      const TripsPage(),
      const InboxPage(),
      const AccountPage(),
    ];
    return Scaffold(
      body: screens[tab],
      bottomNavigationBar: NavigationBar(
        height: 70,
        selectedIndex: tab,
        onDestinationSelected: (value) => setState(() => tab = value),
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFE1F4F5),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.explore_outlined),
              selectedIcon: Icon(Icons.explore), label: 'Explore'),
          NavigationDestination(icon: Icon(Icons.favorite_border),
              selectedIcon: Icon(Icons.favorite), label: 'Saved'),
          NavigationDestination(icon: Icon(Icons.calendar_month_outlined),
              selectedIcon: Icon(Icons.calendar_month), label: 'Bookings'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline),
              selectedIcon: Icon(Icons.chat_bubble), label: 'Messages'),
          NavigationDestination(icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person), label: 'Account'),
        ],
      ),
    );
  }
}

class ScreenTitle extends StatelessWidget {
  final String title;
  final String? subtitle;
  const ScreenTitle(this.title, {super.key, this.subtitle});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(color: navy, fontSize: 29,
          fontWeight: FontWeight.w800, letterSpacing: -0.8)),
      if (subtitle != null) ...[
        const SizedBox(height: 5),
        Text(subtitle!, style: const TextStyle(color: Color(0xFF627C88))),
      ],
    ]),
  );
}

class ExplorePage extends StatefulWidget {
  const ExplorePage({super.key});
  @override
  State<ExplorePage> createState() => _ExplorePageState();
}

class _ExplorePageState extends State<ExplorePage> {
  final search = TextEditingController();
  late Future<List<Boat>> boats;
  String type = 'All boats';
  @override
  void initState() {
    super.initState();
    reload();
  }

  void reload() => setState(() => boats = loadBoats(query: search.text));
  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('GET BY BOAT',
        style: TextStyle(color: navy, fontWeight: FontWeight.w900,
            fontSize: 19, letterSpacing: 2)),
      actions: [
        IconButton(
          tooltip: 'Refresh listings',
          onPressed: reload,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: RefreshIndicator(
      onRefresh: () async {
        reload();
        await boats;
      },
      child: ListView(padding: const EdgeInsets.only(bottom: 30), children: [
        Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 20),
          padding: const EdgeInsets.fromLTRB(23, 30, 23, 30),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(25),
            gradient: const LinearGradient(
              colors: [Color(0xFF073D5F), Color(0xFF059BA7)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
          ),
          child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.sailing_rounded, color: Colors.white, size: 37),
            SizedBox(height: 25),
            Text('Not just boating.\nA feeling.',
              style: TextStyle(color: Colors.white, fontSize: 31,
                height: 1.15, fontWeight: FontWeight.w900)),
            SizedBox(height: 14),
            Text('Find beautiful boats and discover your next day at sea.',
              style: TextStyle(color: Color(0xFFE3F4F5), fontSize: 14)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 17),
          child: TextField(
            controller: search,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => reload(),
            decoration: InputDecoration(
              hintText: 'Where would you like to go?',
              prefixIcon: const Icon(Icons.search, color: ocean),
              suffixIcon: IconButton(
                tooltip: 'Search',
                icon: const Icon(Icons.arrow_forward),
                onPressed: reload,
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 17),
            children: ['All boats', 'Motorboat', 'Sailboat', 'Catamaran', 'Jetski']
                .map((value) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(value),
                    selected: type == value,
                    onSelected: (_) => setState(() => type = value),
                  ),
                )).toList(),
          ),
        ),
        const ScreenTitle('Explore boats',
          subtitle: 'Discover beautiful boats and compare your options.'),
        FutureBuilder<List<Boat>>(
          future: boats,
          builder: (context, snapshot) {
            if (snapshot.hasError) return const InfoPanel(
              icon: Icons.wifi_off, title: 'Could not load boats',
              detail: 'Check your connection and pull down to refresh.');
            if (!snapshot.hasData) return const Padding(
              padding: EdgeInsets.all(40),
              child: Center(child: CircularProgressIndicator()));
            final filtered = snapshot.data!.where((boat) =>
              type == 'All boats' || boat.type == type).toList();
            if (filtered.isEmpty) return const InfoPanel(
              icon: Icons.sailing_outlined, title: 'No boats found',
              detail: 'Try another destination or boat type.');
            return Column(children: filtered.map((boat) => Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: BoatCard(boat: boat),
            )).toList());
          },
        ),
      ]),
    ),
  );
}

class BoatPhoto extends StatelessWidget {
  final Boat boat;
  final double height;
  const BoatPhoto({super.key, required this.boat, this.height = 205});
  @override
  Widget build(BuildContext context) => SizedBox(
    height: height,
    width: double.infinity,
    child: boat.photos.isNotEmpty
      ? Image.network(
          boat.photos.first,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => const BoatPlaceholder(),
        )
      : const BoatPlaceholder(),
  );
}

class BoatPlaceholder extends StatelessWidget {
  const BoatPlaceholder({super.key});
  @override
  Widget build(BuildContext context) => const ColoredBox(
    color: Color(0xFFDCEEF2),
    child: Center(child: Icon(Icons.sailing, color: ocean, size: 58)),
  );
}

class BoatCard extends StatelessWidget {
  final Boat boat;
  const BoatCard({super.key, required this.boat});
  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => BoatDetails(boat: boat)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        BoatPhoto(boat: boat),
        Padding(
          padding: const EdgeInsets.all(17),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(boat.name, style: const TextStyle(fontSize: 19,
              color: navy, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(boat.subtitle, style: const TextStyle(color: Color(0xFF627C88))),
            const SizedBox(height: 12),
            Row(children: [
              const Icon(Icons.directions_boat_outlined, size: 16, color: ocean),
              const SizedBox(width: 6),
              Expanded(child: Text(boat.type + ' · ' +
                  boat.guests.toString() + ' passengers',
                style: const TextStyle(color: Color(0xFF627C88)))),
              Text(boat.priceText + ' / day',
                style: const TextStyle(color: navy, fontWeight: FontWeight.w800)),
            ]),
          ]),
        ),
      ]),
    ),
  );
}

class BoatDetails extends StatefulWidget {
  final Boat boat;
  const BoatDetails({super.key, required this.boat});
  @override
  State<BoatDetails> createState() => _BoatDetailsState();
}

class _BoatDetailsState extends State<BoatDetails> {
  bool saved = false;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    checkSaved();
  }
  Future<void> checkSaved() async {
    try {
      final value = await isBoatSaved(widget.boat.id);
      if (mounted) setState(() => saved = value);
    } catch (_) { /* Saved status is optional while offline. */ }
  }

  Future<void> toggleSaved() async {
    if (db.auth.currentUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Log in under Account to save boats.')));
      return;
    }
    setState(() => busy = true);
    try {
      await setBoatSaved(widget.boat.id, save: !saved);
      if (mounted) setState(() => saved = !saved);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not update saved boats.')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final boat = widget.boat;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Boat details'),
        actions: [
          IconButton(
            tooltip: saved ? 'Remove from saved' : 'Save boat',
            onPressed: busy ? null : toggleSaved,
            icon: Icon(saved ? Icons.favorite : Icons.favorite_border,
                color: saved ? Colors.redAccent : navy),
          ),
        ],
      ),
      body: ListView(children: [
        if (boat.photos.length > 1)
          SizedBox(
            height: 255,
            child: PageView(children: boat.photos.map((url) =>
              Image.network(url, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const BoatPlaceholder())).toList()),
          )
        else BoatPhoto(boat: boat, height: 255),
        Padding(
          padding: const EdgeInsets.all(22),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(boat.name, style: const TextStyle(fontSize: 28,
              color: navy, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text(boat.subtitle, style: const TextStyle(color: Color(0xFF627C88))),
            const SizedBox(height: 18),
            Wrap(spacing: 8, runSpacing: 8, children: [
              Chip(label: Text(boat.type)),
              Chip(avatar: const Icon(Icons.people_outline, size: 17),
                label: Text(boat.guests.toString() + ' passengers')),
              if (boat.cabins > 0)
                Chip(label: Text(boat.cabins.toString() + ' cabins')),
              if (boat.withSkipper)
                const Chip(label: Text('Skipper available')),
              if (boat.withoutSkipper)
                const Chip(label: Text('Self-drive available')),
            ]),
            const SizedBox(height: 20),
            if (boat.description.isNotEmpty) ...[
              const Text('About this boat', style: TextStyle(
                color: navy, fontWeight: FontWeight.w800, fontSize: 20)),
              const SizedBox(height: 9),
              Text(boat.description, style: const TextStyle(height: 1.6)),
              const SizedBox(height: 20),
            ],
            const Divider(),
            const SizedBox(height: 12),
            const Text('Rental price', style: TextStyle(color: navy,
              fontWeight: FontWeight.w800, fontSize: 20)),
            const SizedBox(height: 8),
            Text(boat.priceText + ' / day',
              style: const TextStyle(fontSize: 24, color: ocean,
                  fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('Booking fees and optional skipper costs are shown '
              'during the secure booking request on Get By Boat.',
              style: TextStyle(color: Color(0xFF627C88), height: 1.5)),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, height: 53,
              child: FilledButton.icon(
                onPressed: () => openWebsite(context, 'listing/' + boat.id),
                icon: const Icon(Icons.calendar_month_outlined),
                label: const Text('Request booking'),
              ),
            ),
            const SizedBox(height: 10),
            const Text('Continue on getbyboat.net to select dates and '
              'submit a request. Payment is processed only after owner approval.',
              textAlign: TextAlign.center, style: TextStyle(
                color: Color(0xFF627C88), fontSize: 12)),
          ]),
        ),
      ]),
    );
  }
}

class InfoPanel extends StatelessWidget {
  final IconData icon;
  final String title;
  final String detail;
  const InfoPanel({super.key, required this.icon, required this.title,
      required this.detail});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(26),
    child: Column(children: [
      Icon(icon, color: ocean, size: 47),
      const SizedBox(height: 16),
      Text(title, textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 20, color: navy,
          fontWeight: FontWeight.w800)),
      const SizedBox(height: 9),
      Text(detail, textAlign: TextAlign.center,
        style: const TextStyle(color: Color(0xFF627C88))),
    ]),
  );
}

class LoginRequired extends StatelessWidget {
  final String task;
  const LoginRequired({super.key, required this.task});
  @override
  Widget build(BuildContext context) => InfoPanel(
    icon: Icons.lock_outline,
    title: 'Log in to ' + task,
    detail: 'Use your existing Get By Boat account in the Account tab.',
  );
}

class SavedPage extends StatefulWidget {
  const SavedPage({super.key});
  @override
  State<SavedPage> createState() => _SavedPageState();
}
class _SavedPageState extends State<SavedPage> {
  late Future<List<Boat>> saved;
  @override
  void initState() {
    super.initState();
    saved = loadSavedBoats();
  }
  void reload() => setState(() => saved = loadSavedBoats());
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Saved boats'), actions: [
      IconButton(icon: const Icon(Icons.refresh), onPressed: reload),
    ]),
    body: db.auth.currentUser == null
      ? const LoginRequired(task: 'save boats')
      : RefreshIndicator(
        onRefresh: () async { reload(); await saved; },
        child: ListView(children: [
          const ScreenTitle('Your favourites', subtitle: 'Boats you love, all in one place.'),
          FutureBuilder<List<Boat>>(
            future: saved,
            builder: (context, snapshot) {
              if (snapshot.hasError) return const InfoPanel(
                icon: Icons.wifi_off, title: 'Could not load saved boats',
                detail: 'Pull down to try again.');
              if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
              if (snapshot.data!.isEmpty) return const InfoPanel(
                icon: Icons.favorite_border, title: 'Nothing saved yet',
                detail: 'Tap the heart on any boat to keep it here.');
              return Column(children: snapshot.data!.map((boat) => Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: BoatCard(boat: boat),
              )).toList());
            },
          ),
        ]),
      ),
  );
}

Color statusColor(String status) {
  if (status == 'confirmed' || status == 'awaiting_payment') {
    return const Color(0xFF20764A);
  }
  if (status == 'declined' || status == 'cancelled') {
    return const Color(0xFFAE3747);
  }
  return const Color(0xFF94621A);
}

class TripCard extends StatelessWidget {
  final Trip trip;
  final VoidCallback? onTap;
  const TripCard({super.key, required this.trip, this.onTap});
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
    child: InkWell(
      borderRadius: BorderRadius.circular(19),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(17),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(trip.boatName, style: const TextStyle(
              color: navy, fontWeight: FontWeight.w800, fontSize: 18))),
            if (trip.role == 'owner') const Icon(Icons.storefront_outlined,
              size: 18, color: ocean),
          ]),
          const SizedBox(height: 7),
          Text(trip.dates, style: const TextStyle(color: Color(0xFF627C88))),
          const SizedBox(height: 12),
          Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
            DecoratedBox(
              decoration: BoxDecoration(
                color: statusColor(trip.status).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                child: Text(trip.statusLabel,
                  style: TextStyle(color: statusColor(trip.status),
                    fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ),
            if (onTap != null) const Text('Open messages',
              style: TextStyle(color: ocean, fontSize: 12)),
          ]),
        ]),
      ),
    ),
  );
}

class TripsPage extends StatefulWidget {
  const TripsPage({super.key});
  @override
  State<TripsPage> createState() => _TripsPageState();
}
class _TripsPageState extends State<TripsPage> {
  late Future<List<Trip>> trips;
  @override
  void initState() {
    super.initState();
    trips = loadTrips();
  }
  void reload() => setState(() => trips = loadTrips());
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('My bookings'), actions: [
      IconButton(onPressed: reload, icon: const Icon(Icons.refresh)),
    ]),
    body: db.auth.currentUser == null
      ? const LoginRequired(task: 'view bookings')
      : RefreshIndicator(
        onRefresh: () async { reload(); await trips; },
        child: ListView(children: [
          const ScreenTitle('Bookings', subtitle: 'Requests, approvals and your trips.'),
          FutureBuilder<List<Trip>>(
            future: trips,
            builder: (context, snapshot) {
              if (snapshot.hasError) return const InfoPanel(
                icon: Icons.wifi_off, title: 'Could not load bookings',
                detail: 'Pull down to try again.');
              if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
              if (snapshot.data!.isEmpty) return const InfoPanel(
                icon: Icons.calendar_month_outlined, title: 'No bookings yet',
                detail: 'Find a boat and request your first trip.');
              return Column(children: snapshot.data!.map((trip) =>
                TripCard(trip: trip, onTap: () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => ChatPage(trip: trip))))).toList());
            },
          ),
        ]),
      ),
  );
}

class InboxPage extends StatelessWidget {
  const InboxPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Messages')),
    body: db.auth.currentUser == null
      ? const LoginRequired(task: 'view messages')
      : FutureBuilder<List<Trip>>(
        future: loadTrips(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return const InfoPanel(
            icon: Icons.wifi_off, title: 'Could not load conversations',
            detail: 'Please try again.');
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final trips = snapshot.data!;
          if (trips.isEmpty) return const InfoPanel(
            icon: Icons.chat_bubble_outline, title: 'No conversations yet',
            detail: 'Messaging is available after you request a booking.');
          return ListView(children: [
            const ScreenTitle('Conversations',
              subtitle: 'Keep every boat conversation together.'),
            ...trips.map((trip) => TripCard(
              trip: trip, onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => ChatPage(trip: trip))))),
          ]);
        },
      ),
  );
}

class ChatPage extends StatefulWidget {
  final Trip trip;
  const ChatPage({super.key, required this.trip});
  @override
  State<ChatPage> createState() => _ChatPageState();
}
class _ChatPageState extends State<ChatPage> {
  final controller = TextEditingController();
  late Future<List<ChatMessage>> messages;
  bool sending = false;
  @override
  void initState() {
    super.initState();
    reload();
  }
  void reload() => setState(() => messages = loadMessages(widget.trip.id));
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }
  Future<void> submit() async {
    if (sending || controller.text.trim().isEmpty) return;
    setState(() => sending = true);
    try {
      await sendMessage(widget.trip.id, controller.text);
      controller.clear();
      if (mounted) reload();
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not send message. Please try again.')));
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.trip.boatName, style: const TextStyle(fontSize: 17)),
        Text(widget.trip.dates,
          style: const TextStyle(fontSize: 12, color: Color(0xFF627C88))),
      ],
    ), actions: [
      IconButton(icon: const Icon(Icons.refresh), onPressed: reload),
    ]),
    body: Column(children: [
      Expanded(child: FutureBuilder<List<ChatMessage>>(
        future: messages,
        builder: (context, snapshot) {
          if (snapshot.hasError) return const InfoPanel(
            icon: Icons.wifi_off, title: 'Could not load messages',
            detail: 'Tap refresh to try again.');
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          if (snapshot.data!.isEmpty) return const InfoPanel(
            icon: Icons.chat_bubble_outline, title: 'Start the conversation',
            detail: 'Messages stay connected to this booking.');
          return ListView(
            padding: const EdgeInsets.all(16),
            children: snapshot.data!.map((message) {
              final mine = message.senderId == db.auth.currentUser?.id;
              return Align(
                alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 310),
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
                  decoration: BoxDecoration(
                    color: mine ? const Color(0xFFD9F1EF) : Colors.white,
                    borderRadius: BorderRadius.circular(17),
                  ),
                  child: Text(message.text),
                ),
              );
            }).toList(),
          );
        },
      )),
      SafeArea(top: false, child: Container(
        color: Colors.white,
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Row(children: [
          Expanded(child: TextField(
            controller: controller, maxLength: 2000, minLines: 1, maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(hintText: 'Write a message',
              counterText: '', isDense: true),
            onSubmitted: (_) => submit(),
          )),
          const SizedBox(width: 8),
          IconButton.filled(
            tooltip: 'Send message',
            onPressed: sending ? null : submit,
            icon: const Icon(Icons.send_rounded),
          ),
        ]),
      )),
    ]),
  );
}

class AccountPage extends StatefulWidget {
  const AccountPage({super.key});
  @override
  State<AccountPage> createState() => _AccountPageState();
}
class _AccountPageState extends State<AccountPage> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool signup = false;
  bool busy = false;
  String notice = '';

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> login() async {
    if (email.text.trim().isEmpty || password.text.length < 6) {
      setState(() => notice = 'Enter your email and a password of at least 6 characters.');
      return;
    }
    setState(() { busy = true; notice = ''; });
    try {
      if (signup) {
        await db.auth.signUp(email: email.text.trim(), password: password.text);
        if (mounted) setState(() =>
          notice = 'Account created. Check your email to confirm it, then log in.');
      } else {
        await db.auth.signInWithPassword(email: email.text.trim(), password: password.text);
        if (mounted) setState(() => notice = '');
      }
    } on AuthException catch (error) {
      if (mounted) setState(() => notice = error.message);
    } catch (_) {
      if (mounted) setState(() => notice = 'Could not connect. Please try again.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> resetPassword() async {
    if (email.text.trim().isEmpty) {
      setState(() => notice = 'Enter your email address first.');
      return;
    }
    try {
      await db.auth.resetPasswordForEmail(email.text.trim(),
          redirectTo: 'https://getbyboat.net/#/login');
      if (mounted) setState(() => notice = 'Check your email for reset instructions.');
    } catch (_) {
      if (mounted) setState(() => notice = 'Could not send reset email.');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('My account')),
    body: StreamBuilder<AuthState>(
      stream: db.auth.onAuthStateChange,
      builder: (context, snapshot) {
        final user = db.auth.currentUser;
        if (user != null) return ListView(padding: const EdgeInsets.all(22), children: [
          const Icon(Icons.account_circle, color: ocean, size: 72),
          const SizedBox(height: 12),
          const Text('Welcome aboard', textAlign: TextAlign.center,
            style: TextStyle(fontSize: 27, color: navy, fontWeight: FontWeight.w800)),
          const SizedBox(height: 5),
          Text(user.email ?? 'Get By Boat member', textAlign: TextAlign.center),
          const SizedBox(height: 30),
          Card(child: Column(children: [
            ListTile(leading: const Icon(Icons.manage_accounts_outlined),
              title: const Text('Manage your profile'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => openWebsite(context, 'account')),
            const Divider(height: 1),
            ListTile(leading: const Icon(Icons.verified_user_outlined),
              title: const Text('Verification documents'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => openWebsite(context, 'account')),
            const Divider(height: 1),
            ListTile(leading: const Icon(Icons.support_agent_outlined),
              title: const Text('Contact support'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => openWebsite(context, 'contact')),
          ])),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: () async {
              await db.auth.signOut();
              if (mounted) setState(() {});
            },
            icon: const Icon(Icons.logout),
            label: const Text('Log out'),
          ),
          const SizedBox(height: 22),
          const Text('Your bookings and messages are protected by your '
            'existing Get By Boat account.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF627C88))),
        ]);
        return ListView(padding: const EdgeInsets.all(22), children: [
          const ScreenTitle('Welcome aboard',
            subtitle: 'Your next adventure starts here.'),
          const SizedBox(height: 18),
          Text(signup ? 'Create account' : 'Log in',
            style: const TextStyle(color: ocean, fontWeight: FontWeight.w800,
              fontSize: 22)),
          const SizedBox(height: 17),
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 13),
          TextField(
            controller: password,
            obscureText: true,
            autofillHints: [signup ? AutofillHints.newPassword : AutofillHints.password],
            decoration: const InputDecoration(labelText: 'Password'),
          ),
          const SizedBox(height: 17),
          SizedBox(height: 52, child: FilledButton(
            onPressed: busy ? null : login,
            child: Text(busy ? 'Please wait…' :
              signup ? 'Create account' : 'Log in'),
          )),
          TextButton(
            onPressed: () => setState(() { signup = !signup; notice = ''; }),
            child: Text(signup ? 'Already have an account? Log in' :
              'New to Get By Boat? Create account'),
          ),
          if (!signup) TextButton(
            onPressed: resetPassword,
            child: const Text('Forgot password?'),
          ),
          if (notice.isNotEmpty) Padding(
            padding: const EdgeInsets.all(10),
            child: Text(notice, textAlign: TextAlign.center),
          ),
          const SizedBox(height: 26),
          const Text('By using Get By Boat you agree to our terms '
            'and privacy policy.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF627C88), fontSize: 12)),
          TextButton(
            onPressed: () => openWebsite(context, 'privacy'),
            child: const Text('Privacy policy'),
          ),
        ]);
      },
    ),
  );
}
