# iMessage Analysis Tool

A comprehensive Python tool to analyze your iMessage conversation history with detailed visualizations and statistics.

## Features

This tool generates **17+ visualizations** and detailed text statistics including:

### Visualizations
1. **Words per Week** - Track conversation volume over the past 6 months
2. **Word Cloud** - Visual representation of most common words
3. **Conversation Ratio** - See who "drives" the conversation each week
4. **Streak Chart** - Longest streaks of days with messages
5. **Activity Heatmap** - Message activity by hour of day vs day of week
6. **Response Time Analysis** - Median response times (all messages and you responding to them)
7. **Reply Ladder** - Who double-texts more and who ends conversations
8. **Sentiment Trends** - Overall sentiment, your sentiment, and comparison
9. **Topics by Month** - Track travel, work, food, and inside jokes over time
10. **Inside Jokes Word Cloud** - Frequently repeated words/phrases
11. **Compliments vs Logistics** - Ratio of sweet texts vs coordination texts
12. **Top Emoji Over Time** - Track emoji usage trends
13. **Emoji Density** - Emojis per word over time
14. **First Appearances** - First "love you", first heart emoji, first pet name
15. **Big Day Detector** - Outlier days with unusually high message volume
16. **Argument Fingerprint** - Detect potential arguments (rapid responses, long messages, low emoji, negative sentiment)
17. **Travel Mode** - Compare high vs low activity weeks

### Text Statistics
- **Emoji Statistics** - Combined, yours, and theirs with detailed breakdowns

## Privacy

**All visualizations are anonymized** - no phone numbers or contact names appear in plots or output. Personal information is only used internally to query the database.

## Requirements

- Python 3.7+
- macOS (access to `~/Library/Messages/chat.db`)
- Required Python packages (see `requirements.txt`)

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
pip3 install -r requirements.txt
```

## Usage

### Basic Usage

```bash
python3 imessage_analysis.py "+1 (123) 456-7890"
```

### With Contact Name (optional, for internal reference only)

```bash
python3 imessage_analysis.py "+1 (123) 456-7890" --name "Contact Name"
```

### Phone Number Formats

The script accepts phone numbers in various formats:
- `"+1 (123) 456-7890"`
- `"+11234567890"`
- `"1234567890"`

The script automatically normalizes the format for database searching.

### Help

```bash
python3 imessage_analysis.py --help
```

## Output

The script generates:

1. **Console Output** - Real-time progress and detailed text statistics including:
   - Message counts and word counts
   - Emoji statistics (combined, yours, theirs)

2. **Visualizations** - All plots are saved to the `imessage_plots/` directory:
   - `1_words_per_week.png`
   - `2_wordcloud.png`
   - `3_conversation_ratio.png`
   - `4_streak_chart.png`
   - `5_activity_heatmap.png`
   - `6_response_time.png` (combined)
   - `6a_response_time_all.png`
   - `6b_response_time_you_to_her.png`
   - `7_reply_ladder.png`
   - `8_sentiment_trend.png`
   - `8b_sentiment_you_over_time.png`
   - `8c_sentiment_comparison.png`
   - `9_topics_by_month.png`
   - `10_inside_jokes_wordcloud.png`
   - `11_compliments_vs_logistics.png`
   - `12_top_emoji_over_time.png`
   - `13_emoji_density.png`
   - `14_first_appearances.png`
   - `15_big_day_detector.png`
   - `16_argument_fingerprint.png`
   - `17_travel_mode.png`

## Features Explained

### Reaction Filtering
The script automatically filters out iMessage reactions (messages with quoted text in single quotes, e.g., "Gaf een hartje aan 'i love you so much'"). These are excluded from all analyses.

### Sentiment Analysis
Uses TextBlob for sentiment analysis (with fallback heuristics if not installed). Sentiment scores range from -1 (negative) to +1 (positive).

### Emoji Analysis
Tracks emoji usage over time, density per message, and provides detailed statistics comparing your emoji usage vs theirs.


## Troubleshooting

### Database Locked
If you get a database lock error, close the Messages app and try again.

### No Messages Found
- Verify the phone number format
- Check that you have messages with this contact in your iMessage history
- The phone number might be stored in a different format in the database

### Missing Dependencies
If you see warnings about missing packages (like `textblob` or `emoji`), install them:
```bash
pip3 install textblob emoji
```

Note: The script will work without these packages but with reduced functionality (basic sentiment analysis fallback, limited emoji detection).

## Notes

- The script reads from `~/Library/Messages/chat.db` - your iMessage database
- All analysis is done locally - no data is sent anywhere
- The script filters out reaction messages automatically
- All visualizations are anonymized for privacy

## License

This is a personal analysis tool. Use at your own discretion.

