import 'package:flutter_test/flutter_test.dart';
import 'package:get_by_boat/data.dart';

void main() {
  test('boat data keeps published listing prices and available options', () {
    final boat = Boat.fromJson({
      'id': 'abc',
      'name': 'Test Motorboat',
      'location': 'Split',
      'country': 'Croatia',
      'type': 'Motorboat',
      'price': 249.50,
      'guests': 7,
      'cabins': 0,
      'with_skipper': true,
      'without_skipper': true,
      'photo_url': 'https://example.com/a.jpg',
      'photo_urls': ['https://example.com/b.jpg'],
    });
    expect(boat.name, 'Test Motorboat');
    expect(boat.price, 249.5);
    expect(boat.priceText, '€249.50');
    expect(boat.guests, 7);
    expect(boat.photos.length, 2);
    expect(boat.withSkipper, isTrue);
  });

  test('trip status is clearly labelled', () {
    final trip = Trip.fromJson({
      'id': 'booking-one',
      'boats': {'name': 'Seaside'},
      'start_date': '2027-08-01',
      'end_date': '2027-08-03',
      'status': 'awaiting_payment',
      'guests': 4,
      'total': 900,
    }, 'customer');
    expect(trip.boatName, 'Seaside');
    expect(trip.statusLabel, 'Approved · awaiting payment');
    expect(trip.dates, '2027-08-01 – 2027-08-03');
  });
}
