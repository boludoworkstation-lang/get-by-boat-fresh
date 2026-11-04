import 'dart:async';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'data.dart';

const ocean = Color(0xFF057F91);
const navy = Color(0xFF123A50);
const mist = Color(0xFFF2F8FA);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: supabaseUrl, publishableKey: supabasePublishableKey);
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

final savedBoatIds = ValueNotifier<Set<String>>(<String>{});

Future<void> refreshSavedBoatIds() async {
  final user = db.auth.currentUser;
  if (user == null) {
    savedBoatIds.value = <String>{};
    return;
  }
  try {
    final rows = await db.from('favourites').select('boat_id').eq('user_id', user.id);
    savedBoatIds.value = rows.map((row) => row['boat_id'].toString()).toSet();
  } catch (_) {
    // Keep cached favourites while the network is unavailable.
  }
}

class BoatSaveButton extends StatelessWidget {
  final String boatId;
  final bool light;
  const BoatSaveButton({super.key, required this.boatId, this.light = false});
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<Set<String>>(
    valueListenable: savedBoatIds,
    builder: (context, ids, _) {
      final saved = ids.contains(boatId);
      return Material(
        color: light ? Colors.white : Colors.transparent,
        shape: const CircleBorder(),
        child: IconButton(
          tooltip: saved ? 'Remove from saved' : 'Save boat',
          onPressed: () async {
            if (db.auth.currentUser == null) {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                content: Text('Log in under Account to save boats.')));
              return;
            }
            try {
              await setBoatSaved(boatId, save: !saved);
              savedBoatIds.value = {
                ...ids.where((id) => id != boatId),
                if (!saved) boatId,
              };
            } catch (_) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text('Could not update saved boats. Try again.')));
              }
            }
          },
          icon: Icon(saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            color: saved ? const Color(0xFFDE5361) : navy, size: 21),
        ),
      );
    },
  );
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
      scaffoldBackgroundColor: const Color(0xFFF7FAF9),
      appBarTheme: const AppBarTheme(
        backgroundColor: const Color(0xFFF7FAF9),
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
        height: 67,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        selectedIndex: tab,
        onDestinationSelected: (value) => setState(() => tab = value),
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFE2F3F1),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.search_rounded),
              selectedIcon: Icon(Icons.explore_rounded), label: 'Explore'),
          NavigationDestination(icon: Icon(Icons.favorite_border_rounded),
              selectedIcon: Icon(Icons.favorite_rounded), label: 'Saved'),
          NavigationDestination(icon: Icon(Icons.calendar_today_outlined),
              selectedIcon: Icon(Icons.calendar_month_rounded), label: 'Trips'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline_rounded),
              selectedIcon: Icon(Icons.chat_bubble_rounded), label: 'Inbox'),
          NavigationDestination(icon: Icon(Icons.person_outline_rounded),
              selectedIcon: Icon(Icons.person_rounded), label: 'Profile'),
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
  Timer? debounce;
  late Future<List<Boat>> boats;
  String type = 'All';

  @override
  void initState() {
    super.initState();
    reload();
    refreshSavedBoatIds();
  }
  void reload() => setState(() => boats = loadBoats(query: search.text));
  void searchFor(String value) {
    search.text = value;
    reload();
  }
  @override
  void dispose() {
    debounce?.cancel();
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          reload();
          await boats;
          await refreshSavedBoatIds();
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 26),
          children: [
            Row(children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: ocean,
                  borderRadius: BorderRadius.circular(13)),
                child: const Icon(Icons.waves_rounded, color: Colors.white, size: 27),
              ),
              const SizedBox(width: 10),
              const Text('get by boat', style: TextStyle(
                color: navy, fontWeight: FontWeight.w900,
                fontSize: 22, letterSpacing: -1)),
              const Spacer(),
              IconButton(
                tooltip: 'Share Get By Boat',
                onPressed: () => SharePlus.instance.share(ShareParams(
                  text: 'The best days happen on the water 🌊\n'
                    'Discover boats: https://getbyboat.net')),
                icon: const Icon(Icons.ios_share_rounded, color: navy)),
            ]),
            const SizedBox(height: 24),
            const Text('Find your escape.', style: TextStyle(
              color: navy, fontSize: 32,
              fontWeight: FontWeight.w900, letterSpacing: -1.2)),
            const SizedBox(height: 4),
            const Text('The best days happen on the water.',
              style: TextStyle(color: Color(0xFF73858B), fontSize: 14)),
            const SizedBox(height: 20),
            TextField(
              controller: search,
              textInputAction: TextInputAction.search,
              onChanged: (_) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 320), () {
                  if (mounted) reload();
                });
              },
              onSubmitted: (_) {
                debounce?.cancel();
                reload();
              },
              decoration: InputDecoration(
                hintText: 'Search a destination or boat',
                hintStyle: const TextStyle(color: Color(0xFF88979B)),
                prefixIcon: const Icon(Icons.search_rounded, color: ocean, size: 25),
                suffixIcon: search.text.isNotEmpty
                  ? IconButton(
                      tooltip: 'Clear search',
                      onPressed: () => searchFor(''),
                      icon: const Icon(Icons.close_rounded, size: 20),
                    ) : null,
                contentPadding: const EdgeInsets.symmetric(vertical: 18),
                filled: true, fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 17),
            ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: SizedBox(height: 168, child: Stack(fit: StackFit.expand, children: [
                Image.network('https://getbyboat.net/assets/hero-mediterranean.webp',
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const ColoredBox(
                    color: Color(0xFF0A7C95))),
                const DecoratedBox(decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft, end: Alignment.centerRight,
                    colors: [Color(0xCC062E43), Color(0x12062E43)]))),
                const Positioned(left: 21, bottom: 22, right: 35,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('GET OUT THERE', style: TextStyle(
                      color: Color(0xFFE4F7F8), fontSize: 10,
                      fontWeight: FontWeight.w700, letterSpacing: 2)),
                    SizedBox(height: 8),
                    Text('Not just boating.\nA feeling.',
                      style: TextStyle(color: Colors.white, fontSize: 25,
                        height: 1.09, fontWeight: FontWeight.w800)),
                  ]),
                ),
              ])),
            ),
            const SizedBox(height: 23),
            const Text('Explore destinations', style: TextStyle(
              fontSize: 18, color: navy, fontWeight: FontWeight.w800)),
            const SizedBox(height: 11),
            SingleChildScrollView(scrollDirection: Axis.horizontal,
              child: Row(children: [
                destinationChip('Split', () => searchFor('Split')),
                destinationChip('Athens', () => searchFor('Athens')),
                destinationChip('Ibiza', () => searchFor('Ibiza')),
                destinationChip('Dubrovnik', () => searchFor('Dubrovnik')),
                destinationChip('Nassau', () => searchFor('Nassau')),
              ]),
            ),
            const SizedBox(height: 24),
            const Text('Choose your boat', style: TextStyle(
              fontSize: 18, color: navy, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            SingleChildScrollView(scrollDirection: Axis.horizontal,
              child: Row(children: [
                for (final value in ['All', 'Motorboat', 'Sailboat', 'Catamaran', 'Jetski'])
                  Padding(padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(value),
                      selected: type == value,
                      backgroundColor: Colors.white,
                      selectedColor: const Color(0xFFDDF0EF),
                      side: BorderSide(color: type == value
                        ? ocean : const Color(0xFFE1EAEB)),
                      onSelected: (_) => setState(() => type = value),
                    ),
                  ),
              ]),
            ),
            const SizedBox(height: 26),
            Row(children: [
              const Expanded(child: Text('Boats you’ll love', style: TextStyle(
                fontSize: 24, color: navy,
                fontWeight: FontWeight.w900, letterSpacing: -.6))),
              TextButton(
                onPressed: () { searchFor(''); setState(() => type = 'All'); },
                child: const Text('See all'),
              ),
            ]),
            const SizedBox(height: 5),
            FutureBuilder<List<Boat>>(
              future: boats,
              builder: (context, snapshot) {
                if (snapshot.hasError) return Column(children: [
                  const InfoPanel(icon: Icons.wifi_off_rounded,
                    title: 'Could not load boats',
                    detail: 'Check your connection and try again.'),
                  FilledButton(onPressed: reload, child: const Text('Try again')),
                ]);
                if (!snapshot.hasData) return const Padding(
                  padding: EdgeInsets.all(35),
                  child: Center(child: CircularProgressIndicator()));
                final matches = snapshot.data!.where((boat) =>
                  type == 'All' || boat.type == type).toList();
                if (matches.isEmpty) return Column(children: [
                  const InfoPanel(icon: Icons.sailing_rounded,
                    title: 'No boats found',
                    detail: 'Try a different destination or boat type.'),
                  OutlinedButton(
                    onPressed: () { searchFor(''); setState(() => type = 'All'); },
                    child: const Text('Clear filters'),
                  ),
                ]);
                return Column(children: [
                  Padding(padding: const EdgeInsets.only(bottom: 13),
                    child: Align(alignment: Alignment.centerLeft,
                      child: Text(matches.length.toString() + ' boats to explore',
                        style: const TextStyle(color: Color(0xFF71858B), fontSize: 12)),
                    ),
                  ),
                  ...matches.map((boat) => Padding(
                    padding: const EdgeInsets.only(bottom: 15),
                    child: BoatCard(boat: boat),
                  )),
                ]);
              },
            ),
          ],
        ),
      ),
    ),
  );

  Widget destinationChip(String label, VoidCallback onTap) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ActionChip(
      avatar: const Icon(Icons.place_outlined, color: ocean, size: 17),
      label: Text(label),
      backgroundColor: Colors.white,
      side: const BorderSide(color: Color(0xFFE0EAEC)),
      onPressed: onTap,
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
    margin: EdgeInsets.zero,
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => BoatDetails(boat: boat))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Stack(children: [
          BoatPhoto(boat: boat, height: 225),
          Positioned(top: 13, left: 13,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
              decoration: BoxDecoration(color: Colors.white,
                borderRadius: BorderRadius.circular(20)),
              child: Text(boat.type, style: const TextStyle(
                color: navy, fontSize: 11, fontWeight: FontWeight.w800)),
            ),
          ),
          Positioned(top: 10, right: 10,
            child: BoatSaveButton(boatId: boat.id, light: true)),
        ]),
        Padding(padding: const EdgeInsets.fromLTRB(17, 15, 17, 17),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(boat.name, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: navy, fontSize: 19,
                fontWeight: FontWeight.w900, letterSpacing: -.3)),
            const SizedBox(height: 5),
            Row(children: [
              const Icon(Icons.place_outlined, size: 16,
                color: Color(0xFF71878D)),
              const SizedBox(width: 2),
              Expanded(child: Text(boat.subtitle, maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Color(0xFF71878D), fontSize: 13))),
            ]),
            const SizedBox(height: 15),
            Row(children: [
              const Icon(Icons.people_alt_outlined, color: ocean, size: 16),
              const SizedBox(width: 5),
              Text(boat.guests.toString() + ' guests',
                style: const TextStyle(color: Color(0xFF667C84), fontSize: 12)),
              if (boat.withSkipper) ...[
                const SizedBox(width: 14),
                const Icon(Icons.check_circle_outline_rounded, color: ocean, size: 16),
                const SizedBox(width: 4),
                const Flexible(child: Text('Skipper option',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: Color(0xFF667C84), fontSize: 12))),
              ],
              const Spacer(),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(boat.priceText, style: const TextStyle(
                  color: navy, fontSize: 18, fontWeight: FontWeight.w900)),
                const Text('/ day', style: TextStyle(
                  color: Color(0xFF71878D), fontSize: 11)),
              ]),
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
  int currentPhoto = 0;

  Future<void> shareBoat() async {
    final boat = widget.boat;
    await SharePlus.instance.share(ShareParams(
      title: boat.name,
      text: 'This boat looks like the perfect sea day! 🌊\n' +
        boat.name + ' · ' + boat.subtitle + '\n' +
        'https://getbyboat.net/#/listing/' + boat.id,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final boat = widget.boat;
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: const Text('Boat details', style: TextStyle(
          fontSize: 16, fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            tooltip: 'Share this boat',
            onPressed: shareBoat,
            icon: const Icon(Icons.ios_share_rounded, color: navy)),
          BoatSaveButton(boatId: boat.id),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(children: [
        Expanded(child: ListView(children: [
          SizedBox(height: 290, child: Stack(children: [
            PageView(
              onPageChanged: (value) => setState(() => currentPhoto = value),
              children: boat.photos.isNotEmpty
                ? boat.photos.map((url) => Image.network(
                    url, width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const BoatPlaceholder())).toList()
                : [const BoatPlaceholder()],
            ),
            if (boat.photos.length > 1)
              Positioned(right: 15, bottom: 15,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xB8000000),
                    borderRadius: BorderRadius.circular(20)),
                  child: Text(
                    (currentPhoto + 1).toString() + ' / ' +
                      boat.photos.length.toString(),
                    style: const TextStyle(color: Colors.white, fontSize: 12))),
              ),
          ])),
          Padding(
            padding: const EdgeInsets.fromLTRB(21, 23, 21, 35),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(boat.name, style: const TextStyle(
                color: navy, fontSize: 27, fontWeight: FontWeight.w900)),
              const SizedBox(height: 9),
              Row(children: [
                const Icon(Icons.place_outlined,
                  color: Color(0xFF6D858C), size: 18),
                const SizedBox(width: 5),
                Expanded(child: Text(boat.subtitle,
                  style: const TextStyle(color: Color(0xFF6D858C)))),
              ]),
              const SizedBox(height: 21),
              Wrap(spacing: 9, runSpacing: 9, children: [
                infoPill(Icons.directions_boat_outlined, boat.type),
                infoPill(Icons.people_alt_outlined,
                  boat.guests.toString() + ' guests'),
                if (boat.cabins > 0)
                  infoPill(Icons.bed_outlined, boat.cabins.toString() + ' cabins'),
                if (boat.withSkipper)
                  infoPill(Icons.check_circle_outline, 'Skipper available'),
                if (boat.withoutSkipper)
                  infoPill(Icons.anchor_outlined, 'Self-drive option'),
              ]),
              const SizedBox(height: 25),
              const Divider(color: Color(0xFFE8EEEE)),
              const SizedBox(height: 18),
              const Text('Your next day at sea',
                style: TextStyle(color: navy, fontSize: 21,
                  fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              Text(
                boat.description.isEmpty
                  ? 'Discover this boat and choose the perfect dates '
                    'for your next escape on the water.'
                  : boat.description,
                style: const TextStyle(color: Color(0xFF546A73),
                  height: 1.6, fontSize: 14)),
              const SizedBox(height: 22),
              OutlinedButton.icon(
                onPressed: shareBoat,
                icon: const Icon(Icons.ios_share_rounded, size: 20),
                label: const Text('Send this boat to a friend'),
              ),
              const SizedBox(height: 16),
              const Text('Payment is processed only after booking approval. '
                'All fees and available skipper options are shown before '
                'you submit a request.',
                style: TextStyle(color: Color(0xFF71858B),
                  fontSize: 12, height: 1.6)),
            ]),
          ),
        ])),
        SafeArea(top: false, child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Color(0xFFE9EFEF)))),
          padding: const EdgeInsets.fromLTRB(20, 13, 20, 12),
          child: Row(children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(boat.priceText, style: const TextStyle(
                color: navy, fontSize: 23, fontWeight: FontWeight.w900)),
              const Text('per day', style: TextStyle(
                fontSize: 12, color: Color(0xFF70868D))),
            ]),
            const SizedBox(width: 22),
            Expanded(child: SizedBox(height: 50, child: FilledButton(
              onPressed: () => openWebsite(context, 'listing/' + boat.id),
              child: const Text('Request to book',
                style: TextStyle(fontWeight: FontWeight.w800)),
            ))),
          ]),
        )),
      ]),
    );
  }

  Widget infoPill(IconData icon, String title) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(
      color: const Color(0xFFF2F8F8),
      borderRadius: BorderRadius.circular(11)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, color: ocean, size: 17),
      const SizedBox(width: 7),
      Text(title, style: const TextStyle(
        color: navy, fontSize: 12, fontWeight: FontWeight.w600)),
    ]),
  );
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
    savedBoatIds.addListener(onSavedChanged);
  }
  void onSavedChanged() {
    if (mounted) reload();
  }
  @override
  void dispose() {
    savedBoatIds.removeListener(onSavedChanged);
    super.dispose();
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
    backgroundColor: const Color(0xFFF7FAF9),
    body: SafeArea(child: StreamBuilder<AuthState>(
      stream: db.auth.onAuthStateChange,
      builder: (context, snapshot) {
        final user = db.auth.currentUser;
        if (user != null) return ListView(
          padding: const EdgeInsets.fromLTRB(20, 27, 20, 30),
          children: [
            const Text('Profile', style: TextStyle(color: navy,
              fontSize: 30, fontWeight: FontWeight.w900)),
            const SizedBox(height: 26),
            Row(children: [
              Container(width: 62, height: 62,
                decoration: const BoxDecoration(
                  color: Color(0xFFDCF0EE), shape: BoxShape.circle),
                child: const Icon(Icons.person_rounded, color: ocean, size: 34)),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Welcome aboard!', style: TextStyle(
                  color: navy, fontSize: 20, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(user.email ?? 'Get By Boat member',
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Color(0xFF72868B))),
              ])),
            ]),
            const SizedBox(height: 30),
            Card(clipBehavior: Clip.antiAlias, child: Column(children: [
              ListTile(leading: const Icon(Icons.manage_accounts_outlined, color: ocean),
                title: const Text('Personal details'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => openWebsite(context, 'account')),
              const Divider(height: 1),
              ListTile(leading: const Icon(Icons.verified_user_outlined, color: ocean),
                title: const Text('Document verification'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => openWebsite(context, 'account')),
              const Divider(height: 1),
              ListTile(leading: const Icon(Icons.support_agent_outlined, color: ocean),
                title: const Text('Help & support'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => openWebsite(context, 'contact')),
            ])),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: const Icon(Icons.ios_share_rounded, color: ocean),
              title: const Text('Invite a friend'),
              subtitle: const Text('Good days are better together'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => SharePlus.instance.share(ShareParams(
                text: 'Let’s find our next sea day! 🌊\n'
                  'Explore boats on https://getbyboat.net')),
            )),
            const SizedBox(height: 25),
            OutlinedButton.icon(
              onPressed: () async {
                await db.auth.signOut();
                await refreshSavedBoatIds();
                if (mounted) setState(() {});
              },
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Log out'),
            ),
          ],
        );
        return ListView(
          padding: const EdgeInsets.fromLTRB(22, 34, 22, 30),
          children: [
            Center(child: Container(
              width: 60, height: 60,
              decoration: BoxDecoration(color: ocean,
                borderRadius: BorderRadius.circular(18)),
              child: const Icon(Icons.waves_rounded,
                color: Colors.white, size: 38),
            )),
            const SizedBox(height: 21),
            const Text('Welcome aboard.',
              textAlign: TextAlign.center,
              style: TextStyle(color: navy, fontSize: 30,
                fontWeight: FontWeight.w900, letterSpacing: -.9)),
            const SizedBox(height: 7),
            const Text('Your next adventure starts at sea.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF72868B), fontSize: 14)),
            const SizedBox(height: 30),
            Card(child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 21, 18, 17),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(signup ? 'Create your account' : 'Log in',
                  style: const TextStyle(color: navy,
                    fontSize: 21, fontWeight: FontWeight.w800)),
                const SizedBox(height: 18),
                TextField(controller: email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  decoration: const InputDecoration(labelText: 'Email')),
                const SizedBox(height: 12),
                TextField(controller: password, obscureText: true,
                  autofillHints: [signup
                    ? AutofillHints.newPassword : AutofillHints.password],
                  decoration: const InputDecoration(labelText: 'Password')),
                const SizedBox(height: 17),
                SizedBox(height: 52, child: FilledButton(
                  onPressed: busy ? null : login,
                  child: Text(busy ? 'Please wait…' :
                    signup ? 'Create account' : 'Log in'),
                )),
                TextButton(
                  onPressed: () => setState(() { signup = !signup; notice = ''; }),
                  child: Text(signup ? 'Already registered? Log in' :
                    'New here? Create an account'),
                ),
                if (!signup) TextButton(
                  onPressed: resetPassword,
                  child: const Text('Forgot password?')),
                if (notice.isNotEmpty) Padding(
                  padding: const EdgeInsets.all(10),
                  child: Text(notice, textAlign: TextAlign.center)),
              ]),
            )),
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: () => openWebsite(context, 'login'),
              icon: const Icon(Icons.open_in_browser_rounded, size: 18),
              label: const Text('Continue on getbyboat.net'),
            ),
            const SizedBox(height: 12),
            const Text('By continuing you agree to our terms and privacy policy.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF819196), fontSize: 11)),
            TextButton(
              onPressed: () => openWebsite(context, 'privacy'),
              child: const Text('Privacy policy')),
          ],
        );
      },
    )),
  );
}
