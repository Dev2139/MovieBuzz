import 'package:flutter/material.dart';
import '../../constants/app_colors.dart';
import '../../models/content_request.dart';
import '../../services/api_service.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class RequestsScreen extends StatefulWidget {
  const RequestsScreen({super.key});

  @override
  State<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends State<RequestsScreen> {
  final ApiService _api = ApiService();
  List<ContentRequestItem> _requests = [];
  bool _isLoading = true;
  String _selectedType = 'all';

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    setState(() => _isLoading = true);
    try {
      final list = await _api.getRequestsLeaderboard(
        type: _selectedType == 'all' ? null : _selectedType,
      );
      setState(() {
        _requests = list;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _vote(String id) async {
    try {
      final count = await _api.voteRequest(id);
      setState(() {
        final index = _requests.indexWhere((r) => r.id == id);
        if (index != -1) {
          final old = _requests[index];
          _requests[index] = ContentRequestItem(
            id: old.id,
            title: old.title,
            type: old.type,
            releaseYear: old.releaseYear,
            notes: old.notes,
            status: old.status,
            voteCount: count,
            hasVoted: true,
            createdAt: old.createdAt,
          );
        }
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    }
  }

  void _showNewRequestDialog() {
    final titleController = TextEditingController();
    final yearController = TextEditingController();
    final notesController = TextEditingController();
    String type = 'movie';
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.darkCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 24,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Request a Movie or Series',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  CustomTextField(
                    controller: titleController,
                    hintText: 'e.g. Inception, Breaking Bad',
                    labelText: 'Title *',
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Type',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                            ),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              decoration: BoxDecoration(
                                color: AppColors.darkSurface,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.darkBorder),
                              ),
                              child: DropdownButton<String>(
                                value: type,
                                isExpanded: true,
                                dropdownColor: AppColors.darkCard,
                                underline: const SizedBox(),
                                items: const [
                                  DropdownMenuItem(value: 'movie', child: Text('Movie')),
                                  DropdownMenuItem(value: 'series', child: Text('Series')),
                                ],
                                onChanged: (v) {
                                  if (v != null) setModalState(() => type = v);
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: CustomTextField(
                          controller: yearController,
                          hintText: 'e.g. 2024',
                          labelText: 'Year (Optional)',
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  CustomTextField(
                    controller: notesController,
                    hintText: 'Language, preferred audio, or details',
                    labelText: 'Notes',
                    maxLines: 2,
                  ),
                  const SizedBox(height: 20),
                  CustomButton(
                    text: 'Submit Request',
                    isLoading: isSubmitting,
                    onPressed: () async {
                      if (titleController.text.trim().isEmpty) return;
                      final nav = Navigator.of(context);
                      final messenger = ScaffoldMessenger.of(context);
                      setModalState(() => isSubmitting = true);
                      try {
                        await _api.submitRequest(
                          title: titleController.text.trim(),
                          type: type,
                          releaseYear: int.tryParse(yearController.text.trim()),
                          notes: notesController.text.trim(),
                        );
                        nav.pop();
                        _loadRequests();
                        messenger.showSnackBar(
                          const SnackBar(content: Text('Request submitted successfully!')),
                        );
                      } catch (e) {
                        setModalState(() => isSubmitting = false);
                        messenger.showSnackBar(
                          SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                        );
                      }
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBase,
      appBar: AppBar(
        title: const Text('Community Requests'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline, color: AppColors.brand, size: 28),
            tooltip: 'Request Content',
            onPressed: _showNewRequestDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _buildFilterChip('All Requests', 'all'),
                const SizedBox(width: 8),
                _buildFilterChip('Movies', 'movie'),
                const SizedBox(width: 8),
                _buildFilterChip('Series', 'series'),
              ],
            ),
          ),

          // Requests List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.brand))
                : _requests.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.how_to_vote_outlined,
                                size: 56, color: AppColors.textMuted),
                            const SizedBox(height: 12),
                            const Text(
                              'No requests found',
                              style: TextStyle(color: Colors.white, fontSize: 16),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              onPressed: _showNewRequestDialog,
                              icon: const Icon(Icons.add),
                              label: const Text('Be First to Request'),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.brand,
                        onRefresh: _loadRequests,
                        child: ListView.builder(
                          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                          padding: const EdgeInsets.all(16),
                          itemCount: _requests.length,
                          itemBuilder: (context, index) {
                            final item = _requests[index];

                            return Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.darkCard,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.darkBorder, width: 0.5),
                              ),
                              child: Row(
                                children: [
                                  // Vote Button with Count
                                  GestureDetector(
                                    onTap: () => _vote(item.id),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 12, vertical: 8),
                                      decoration: BoxDecoration(
                                        color: item.hasVoted
                                            ? AppColors.brand
                                            : AppColors.darkSurface,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                          color: item.hasVoted
                                              ? AppColors.brand
                                              : AppColors.darkBorder,
                                        ),
                                      ),
                                      child: Column(
                                        children: [
                                          Icon(
                                            Icons.arrow_upward_rounded,
                                            size: 20,
                                            color: item.hasVoted
                                                ? Colors.white
                                                : AppColors.textSecondary,
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            '${item.voteCount}',
                                            style: TextStyle(
                                              color: item.hasVoted
                                                  ? Colors.white
                                                  : AppColors.textPrimary,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 14),

                                  // Details
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                  horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: item.type == 'series'
                                                    ? AppColors.blue.withOpacity(0.2)
                                                    : AppColors.brand.withOpacity(0.2),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                item.type.toUpperCase(),
                                                style: TextStyle(
                                                  color: item.type == 'series'
                                                      ? AppColors.blue
                                                      : AppColors.brand,
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            if (item.releaseYear != null)
                                              Text(
                                                '${item.releaseYear}',
                                                style: const TextStyle(
                                                  color: AppColors.textMuted,
                                                  fontSize: 12,
                                                ),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          item.title,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15,
                                          ),
                                        ),
                                        if (item.notes != null && item.notes!.isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          Text(
                                            item.notes!,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: AppColors.textSecondary,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),

                                  // Status Badge
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: item.status == 'fulfilled'
                                          ? AppColors.green.withOpacity(0.2)
                                          : Colors.white10,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      item.status.toUpperCase(),
                                      style: TextStyle(
                                        color: item.status == 'fulfilled'
                                            ? AppColors.green
                                            : AppColors.textMuted,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _selectedType == value;
    return GestureDetector(
      onTap: () {
        setState(() => _selectedType = value);
        _loadRequests();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.brand : AppColors.darkCard,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.brand : AppColors.darkBorder,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : AppColors.textSecondary,
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}
