import 'package:supabase_flutter/supabase_flutter.dart';

const supabaseUrl = 'https://oufkqqrhjuspczarzjrr.supabase.co';
const supabasePublishableKey = 'sb_publishable_ct8GK7tOL5jxvHsJqTOFtw_PBYSUe_E';

SupabaseClient get db => Supabase.instance.client;

class Boat {
  final String id;
  final String name;
  final String location;
  final String country;
  final String type;
  final String description;
  final double price;
  final int guests;
  final int cabins;
  final bool withSkipper;
  final bool withoutSkipper;
  final List<String> photos;
  final Map<String, dynamic> specs;

  const Boat({
    required this.id,
    required this.name,
    required this.location,
    required this.country,
    required this.type,
    required this.description,
    required this.price,
    required this.guests,
    required this.cabins,
    required this.withSkipper,
    required this.withoutSkipper,
    required this.photos,
    required this.specs,
  });

  factory Boat.fromJson(Map<String, dynamic> json) {
    final images = <String>[];
    final gallery = json['photo_urls'];
    if (gallery is List) {
      for (final image in gallery) {
        if (image is String && image.startsWith('https://')) {
          images.add(image);
        }
      }
    }
    final cover = json['photo_url'];
    if (cover is String && cover.startsWith('https://') && !images.contains(cover)) {
      images.insert(0, cover);
    }
    return Boat(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? 'Boat').toString(),
      location: (json['location'] ?? '').toString(),
      country: (json['country'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      price: num.tryParse((json['price'] ?? 0).toString())?.toDouble() ?? 0,
      guests: int.tryParse((json['guests'] ?? 0).toString()) ?? 0,
      cabins: int.tryParse((json['cabins'] ?? 0).toString()) ?? 0,
      withSkipper: json['with_skipper'] == true,
      withoutSkipper: json['without_skipper'] == true,
      photos: images,
      specs: json['specifications'] is Map
          ? Map<String, dynamic>.from(json['specifications'] as Map)
          : <String, dynamic>{},
    );
  }

  String get subtitle => [location, country].where((part) => part.isNotEmpty).join(', ');
  String get priceText => '€' + price.toStringAsFixed(price == price.roundToDouble() ? 0 : 2);
}

const boatColumns = 'id,name,location,country,type,description,price,guests,cabins,'
    'with_skipper,without_skipper,photo_url,photo_urls,specifications';

Future<List<Boat>> loadBoats({String? query}) async {
  var request = db.from('boats').select(boatColumns).eq('published', true);
  final term = query?.trim();
  if (term != null && term.isNotEmpty) {
    final safe = term.replaceAll(RegExp(r'[,()%]'), ' ').trim();
    if (safe.isNotEmpty) {
      request = request.or('name.ilike.%' + safe + '%,location.ilike.%' + safe +
          '%,country.ilike.%' + safe + '%,type.ilike.%' + safe + '%');
    }
  }
  final rows = await request.order('created_at', ascending: false).limit(200);
  return rows.map((row) => Boat.fromJson(row)).toList();
}

Future<List<Boat>> loadSavedBoats() async {
  final user = db.auth.currentUser;
  if (user == null) return <Boat>[];
  final rows = await db.from('favourites').select('boat_id').eq('user_id', user.id);
  final ids = rows.map((row) => row['boat_id'].toString()).toList();
  if (ids.isEmpty) return <Boat>[];
  final boats = await db.from('boats').select(boatColumns)
      .eq('published', true).inFilter('id', ids);
  return boats.map((row) => Boat.fromJson(row)).toList();
}

Future<bool> isBoatSaved(String boatId) async {
  final user = db.auth.currentUser;
  if (user == null) return false;
  final rows = await db.from('favourites').select('boat_id')
      .eq('user_id', user.id).eq('boat_id', boatId).limit(1);
  return rows.isNotEmpty;
}

Future<void> setBoatSaved(String boatId, {required bool save}) async {
  final user = db.auth.currentUser;
  if (user == null) throw StateError('Please log in to save boats.');
  if (save) {
    await db.from('favourites').upsert({
      'user_id': user.id,
      'boat_id': boatId,
    });
  } else {
    await db.from('favourites').delete()
        .eq('user_id', user.id).eq('boat_id', boatId);
  }
}

class Trip {
  final String id;
  final String boatName;
  final String start;
  final String end;
  final String status;
  final String role;
  final int guests;
  final double total;

  const Trip({
    required this.id,
    required this.boatName,
    required this.start,
    required this.end,
    required this.status,
    required this.role,
    required this.guests,
    required this.total,
  });

  factory Trip.fromJson(Map<String, dynamic> json, String role) {
    final boat = json['boats'];
    final boatData = boat is Map ? Map<String, dynamic>.from(boat) : <String, dynamic>{};
    return Trip(
      id: (json['id'] ?? '').toString(),
      boatName: (boatData['name'] ?? 'Boat booking').toString(),
      start: (json['start_date'] ?? '').toString(),
      end: (json['end_date'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      role: role,
      guests: int.tryParse((json['guests'] ?? 0).toString()) ?? 0,
      total: num.tryParse((json['total'] ?? 0).toString())?.toDouble() ?? 0,
    );
  }

  String get dates => start + ' – ' + end;
  String get statusLabel {
    switch (status) {
      case 'pending_owner': return 'Awaiting approval';
      case 'awaiting_payment': return 'Approved · awaiting payment';
      case 'confirmed': return 'Confirmed';
      case 'declined': return 'Declined';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  }
}

Future<List<Trip>> loadTrips() async {
  final user = db.auth.currentUser;
  if (user == null) return <Trip>[];
  const columns = 'id,start_date,end_date,status,guests,total,boats(name)';
  final customerRows = await db.from('bookings').select(columns)
      .eq('customer_id', user.id).order('created_at', ascending: false);
  final ownerBoats = await db.from('boats').select('id').eq('owner_id', user.id);
  final ownIds = ownerBoats.map((row) => row['id'].toString()).toList();
  final trips = customerRows.map((row) => Trip.fromJson(row, 'customer')).toList();
  if (ownIds.isNotEmpty) {
    final ownerRows = await db.from('bookings').select(columns)
        .inFilter('boat_id', ownIds).order('created_at', ascending: false);
    final seen = trips.map((trip) => trip.id).toSet();
    for (final row in ownerRows) {
      final trip = Trip.fromJson(row, 'owner');
      if (seen.add(trip.id)) trips.add(trip);
    }
  }
  trips.sort((a, b) => b.start.compareTo(a.start));
  return trips;
}

class ChatMessage {
  final String id;
  final String senderId;
  final String text;
  final DateTime? createdAt;

  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.text,
    required this.createdAt,
  });
  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    id: json['id'].toString(),
    senderId: json['sender_id'].toString(),
    text: (json['content'] ?? '').toString(),
    createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()),
  );
}

Future<List<ChatMessage>> loadMessages(String bookingId) async {
  final rows = await db.from('booking_messages')
      .select('id,sender_id,content,created_at')
      .eq('booking_id', bookingId).order('created_at');
  return rows.map((row) => ChatMessage.fromJson(row)).toList();
}

Future<void> sendMessage(String bookingId, String text) async {
  final user = db.auth.currentUser;
  final content = text.trim();
  if (user == null) throw StateError('Please log in.');
  if (content.isEmpty || content.length > 2000) {
    throw StateError('Write a message of 1–2000 characters.');
  }
  await db.from('booking_messages').insert({
    'booking_id': bookingId,
    'sender_id': user.id,
    'content': content,
  });
}
