class User {
  final String id;
  final String name;
  final String email;
  final String role;
  final bool isPremium;
  final List<String> favorites;
  final List<String> watchlist;
  final List<String> preferredGenres;
  final int cineCoins;
  final int totalCoinsEarned;
  final String? subscriptionPlan;
  final bool subscriptionActive;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.isPremium = false,
    this.favorites = const [],
    this.watchlist = const [],
    this.preferredGenres = const [],
    this.cineCoins = 0,
    this.totalCoinsEarned = 0,
    this.subscriptionPlan,
    this.subscriptionActive = false,
  });

  bool get isAdmin => role == 'admin';

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'User',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString() ?? 'user',
      isPremium: json['isPremium'] == true,
      favorites: (json['favorites'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      watchlist: (json['watchlist'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      preferredGenres: (json['preferredGenres'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      cineCoins: json['cineCoins'] is int
          ? json['cineCoins']
          : int.tryParse(json['cineCoins']?.toString() ?? '0') ?? 0,
      totalCoinsEarned: json['totalCoinsEarned'] is int
          ? json['totalCoinsEarned']
          : int.tryParse(json['totalCoinsEarned']?.toString() ?? '0') ?? 0,
      subscriptionPlan: json['subscriptionPlan']?.toString(),
      subscriptionActive: json['subscriptionActive'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'isPremium': isPremium,
      'favorites': favorites,
      'watchlist': watchlist,
      'preferredGenres': preferredGenres,
      'cineCoins': cineCoins,
      'totalCoinsEarned': totalCoinsEarned,
      'subscriptionPlan': subscriptionPlan,
      'subscriptionActive': subscriptionActive,
    };
  }
}
