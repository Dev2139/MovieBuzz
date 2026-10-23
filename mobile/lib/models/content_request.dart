class ContentRequestItem {
  final String id;
  final String title;
  final String type;
  final int? releaseYear;
  final String? notes;
  final String status; // pending, fulfilled, rejected
  final int voteCount;
  final bool hasVoted;
  final DateTime createdAt;

  ContentRequestItem({
    required this.id,
    required this.title,
    required this.type,
    this.releaseYear,
    this.notes,
    required this.status,
    required this.voteCount,
    this.hasVoted = false,
    required this.createdAt,
  });

  factory ContentRequestItem.fromJson(Map<String, dynamic> json) {
    return ContentRequestItem(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      type: json['type']?.toString() ?? 'movie',
      releaseYear: json['releaseYear'] is int
          ? json['releaseYear']
          : int.tryParse(json['releaseYear']?.toString() ?? ''),
      notes: json['notes']?.toString(),
      status: json['status']?.toString() ?? 'pending',
      voteCount: json['voteCount'] is int
          ? json['voteCount']
          : int.tryParse(json['voteCount']?.toString() ?? '0') ?? 0,
      hasVoted: json['hasVoted'] == true,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}
