import 'package:flutter/material.dart';

class DoubleTapRippleIndicator extends StatelessWidget {
  final bool isForward;
  final VoidCallback onEnd;

  const DoubleTapRippleIndicator({
    super.key,
    required this.isForward,
    required this.onEnd,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 650),
      onEnd: onEnd,
      builder: (context, value, child) {
        return Opacity(
          opacity: (1.0 - value).clamp(0.0, 1.0),
          child: Container(
            width: 110,
            height: 110,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.25),
              shape: BoxShape.circle,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  isForward ? Icons.fast_forward_rounded : Icons.fast_rewind_rounded,
                  color: Colors.white,
                  size: 38,
                ),
                const SizedBox(height: 4),
                Text(
                  isForward ? '+10s' : '-10s',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
