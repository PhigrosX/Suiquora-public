/**
 * Utility functions for date formatting
 */

/**
 * Format timestamp to human readable format in English locale
 */
export const formatTimestamp = (timestamp: number | undefined | null): string => {
  if (!timestamp) return 'Unknown date';

  try {
    // Ensure timestamp is in milliseconds
    const timestampInMs = timestamp > 9999999999 ? timestamp : timestamp * 1000;

    // Format with more detailed and readable format - ensure English locale
    const date = new Date(timestampInMs);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting timestamp:', error, timestamp);
    return 'Invalid date';
  }
};

/**
 * Format date to relative time in English
 */
export const formatRelativeTime = (timestamp: number | undefined | null): string => {
  if (!timestamp) return 'Unknown time';

  try {
    // Ensure timestamp is in milliseconds
    const timestampInMs = timestamp > 9999999999 ? timestamp : timestamp * 1000;
    const date = new Date(timestampInMs);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    // For older dates, show the actual date in English
    return formatTimestamp(timestamp);
  } catch (error) {
    console.error('Error calculating relative time:', error, timestamp);
    return 'unknown time ago';
  }
};

/**
 * Format date for display in UI components
 */
export const formatDateForDisplay = (timestamp: number | undefined | null): string => {
  if (!timestamp) return 'Unknown date';

  try {
    // Ensure timestamp is in milliseconds
    const timestampInMs = timestamp > 9999999999 ? timestamp : timestamp * 1000;

    return new Date(timestampInMs).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date for display:', error, timestamp);
    return 'Invalid date';
  }
};

/**
 * Format time left until a given timestamp
 */
export const formatTimeLeft = (endTime: number): string => {
  const now = new Date();
  const end = new Date(endTime);

  // 检查过期时间是否有效
  if (isNaN(end.getTime())) {
    console.error("Invalid endTime:", endTime);
    return "Unknown";
  }

  // 如果已经过期，返回过期信息
  if (now > end) {
    return "Expired";
  }

  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""}`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""}`;
  } else {
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
  }
};
