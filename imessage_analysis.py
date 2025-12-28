#!/usr/bin/env python3
"""
Script to analyze iMessage history for a specific contact.
Counts sent and received messages, total words, and creates various visualizations.
"""

import sqlite3
import os
from pathlib import Path
import re
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from wordcloud import WordCloud
from collections import defaultdict, Counter
import argparse
import sys
import warnings
warnings.filterwarnings('ignore')

try:
    from textblob import TextBlob
    HAS_TEXTBLOB = True
except ImportError:
    HAS_TEXTBLOB = False
    print("Warning: textblob not installed. Sentiment analysis will be basic.")

try:
    import emoji
    HAS_EMOJI = True
except ImportError:
    HAS_EMOJI = False
    print("Warning: emoji library not installed. Emoji analysis will be limited.")

# Set style
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (12, 6)

def count_words(text):
    """Count words in a text string."""
    if not text or not isinstance(text, str):
        return 0
    # Split by whitespace and filter out empty strings
    words = re.findall(r'\b\w+\b', text)
    return len(words)

def imessage_timestamp_to_datetime(timestamp):
    """Convert iMessage timestamp (nanoseconds since 2001-01-01) to datetime."""
    if timestamp is None:
        return None
    # iMessage timestamps are in nanoseconds since 2001-01-01 00:00:00 UTC
    epoch = datetime(2001, 1, 1)
    seconds = timestamp / 1_000_000_000
    return epoch + timedelta(seconds=seconds)

def clean_text_for_wordcloud(text):
    """Clean text for wordcloud, removing possessive 's and fixing common issues."""
    if not text or not isinstance(text, str):
        return ""
    # Remove possessive 's and standalone 's
    text = re.sub(r"\b\w+'s\b", lambda m: m.group(0)[:-2], text)  # Remove 's
    text = re.sub(r"\s+'s\b", "", text)  # Remove standalone 's
    text = re.sub(r"\b's\b", "", text)  # Remove 's as word
    # Remove single letter 's'
    text = re.sub(r"\b[s]\b", "", text, flags=re.IGNORECASE)
    return text

def get_sentiment(text):
    """Get sentiment score (-1 to 1) for text."""
    if not text or not isinstance(text, str):
        return 0.0
    if HAS_TEXTBLOB:
        try:
            blob = TextBlob(text)
            return blob.sentiment.polarity
        except:
            pass
    # Simple heuristic fallback
    positive_words = ['love', 'happy', 'great', 'amazing', 'wonderful', 'beautiful', 'perfect', 'excited', 'good', 'best', 'awesome', 'fantastic', 'sweet', 'cute', 'adorable', 'miss', '❤️', '😍', '😊', '🥰']
    negative_words = ['sad', 'angry', 'mad', 'bad', 'hate', 'worst', 'terrible', 'awful', 'sorry', 'upset', 'frustrated', 'annoyed', '😢', '😠', '😞']
    text_lower = text.lower()
    pos_count = sum(1 for word in positive_words if word in text_lower)
    neg_count = sum(1 for word in negative_words if word in text_lower)
    if pos_count + neg_count == 0:
        return 0.0
    return (pos_count - neg_count) / (pos_count + neg_count + 1)

def extract_emojis(text):
    """Extract emojis from text."""
    if not text or not isinstance(text, str):
        return []
    if HAS_EMOJI:
        return [c for c in text if c in emoji.EMOJI_DATA]
    # Fallback: basic emoji pattern
    emoji_pattern = re.compile("["
        u"\U0001F600-\U0001F64F"  # emoticons
        u"\U0001F300-\U0001F5FF"  # symbols & pictographs
        u"\U0001F680-\U0001F6FF"  # transport & map symbols
        u"\U0001F1E0-\U0001F1FF"  # flags
        u"\U00002702-\U000027B0"
        u"\U000024C2-\U0001F251"
        "]+", flags=re.UNICODE)
    return emoji_pattern.findall(text)

def classify_message_type(text):
    """Classify message as compliment/sweet vs logistics/coordination."""
    if not text or not isinstance(text, str):
        return 'other'
    text_lower = text.lower()
    
    # Compliment/sweet indicators
    sweet_words = ['love', 'miss', 'beautiful', 'cute', 'adorable', 'sweet', 'amazing', 'wonderful', 
                   'perfect', 'gorgeous', 'handsome', 'pretty', '❤️', '🥰', '😍', '💕', '💖', 
                   'thinking of you', 'wish you were here', 'can\'t wait', 'excited to see']
    
    # Logistics/coordination indicators
    logistics_words = ['when', 'where', 'what time', 'pick up', 'drop off', 'meet', 'location', 
                      'address', 'schedule', 'plan', 'tomorrow', 'today', 'tonight', 'later', 
                      'coming', 'leaving', 'arrive', 'be there', 'on my way', 'running late']
    
    sweet_score = sum(1 for word in sweet_words if word in text_lower)
    logistics_score = sum(1 for word in logistics_words if word in text_lower)
    
    if sweet_score > logistics_score and sweet_score > 0:
        return 'compliment'
    elif logistics_score > 0:
        return 'logistics'
    else:
        return 'other'

def find_inside_jokes(df, min_repeats=3):
    """Find words/phrases that appear frequently (potential inside jokes)."""
    all_text = ' '.join(df['text'].dropna().astype(str))
    words = re.findall(r'\b\w+\b', all_text.lower())
    word_counts = Counter(words)
    
    # Filter out common words
    common_stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
                       'of', 'with', 'by', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'is', 
                       'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 
                       'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 
                       'this', 'that', 'these', 'those', 'what', 'when', 'where', 'why', 'how',
                       'just', 'like', 'get', 'got', 'go', 'going', 'come', 'see', 'know', 'think',
                       'want', 'need', 'make', 'take', 'give', 'say', 'tell', 'ask', 'let', 'put'}
    
    # Find words that appear frequently (potential inside jokes)
    inside_jokes = {word: count for word, count in word_counts.items() 
                   if count >= min_repeats and word not in common_stopwords and len(word) > 2}
    
    return inside_jokes

def is_reaction_message(text):
    """Check if a message is a reaction (contains quoted text in single quotes)."""
    if not text or not isinstance(text, str):
        return False
    # Look for text within single quotes (reactions have quoted messages)
    # Pattern: text within single quotes, e.g., 'i love you so much'
    # This catches reactions like "Gaf een hartje aan 'i love you so much'"
    pattern = r"'.+?'"
    matches = re.findall(pattern, text)
    # If there's quoted text, it's likely a reaction
    return len(matches) > 0

def analyze_imessage_contact(phone_number, contact_name=None):
    """
    Analyze iMessage history for a specific phone number.
    
    Args:
        phone_number: Phone number to search for (e.g., "+1 (123) 456-7890")
        contact_name: Optional contact name for display purposes
    """
    # Path to iMessage database
    db_path = Path.home() / "Library" / "Messages" / "chat.db"
    
    if not db_path.exists():
        print(f"Error: Database not found at {db_path}")
        return
    
    try:
        # Connect to the database
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Normalize phone number for search (remove spaces, parentheses, dashes)
        normalized_phone = phone_number.replace(" ", "").replace("(", "").replace(")", "").replace("-", "")
        
        # Find the handle_id for this phone number
        cursor.execute("""
            SELECT ROWID, id 
            FROM handle 
            WHERE id LIKE ?
        """, (f"%{normalized_phone}%",))
        
        handles = cursor.fetchall()
        
        if not handles:
            print(f"No contact found with phone number: {phone_number}")
            return
        
        # Get all handle_ids that match
        handle_ids = [handle[0] for handle in handles]
        placeholders = ",".join("?" * len(handle_ids))
        
        # Fetch all messages with dates and text
        cursor.execute(f"""
            SELECT date, text, is_from_me 
            FROM message 
            WHERE handle_id IN ({placeholders})
            AND text IS NOT NULL
            ORDER BY date
        """, handle_ids)
        
        messages = cursor.fetchall()
        
        if not messages:
            print(f"No messages found for {phone_number}")
            return
        
        # Process messages into DataFrame
        print("Processing messages and extracting features...")
        print("Filtering out reaction messages (messages with quoted text)...")
        data = []
        reaction_count = 0
        for date_ns, text, is_from_me in messages:
            dt = imessage_timestamp_to_datetime(date_ns)
            if dt:
                # Skip reaction messages (those with quoted text)
                if is_reaction_message(text):
                    reaction_count += 1
                    continue
                
                word_count = count_words(text)
                emojis = extract_emojis(text)
                sentiment = get_sentiment(text)
                msg_type = classify_message_type(text)
                
                data.append({
                    'date': dt,
                    'text': text,
                    'is_from_me': bool(is_from_me),
                    'word_count': word_count,
                    'sender': 'You' if is_from_me else 'Them',
                    'sentiment': sentiment,
                    'emoji_count': len(emojis),
                    'emojis': ' '.join(emojis),
                    'message_type': msg_type
                })
        
        print(f"Filtered out {reaction_count} reaction messages.")
        print(f"Processing {len(data)} regular messages...")
        
        df = pd.DataFrame(data)
        df['date'] = pd.to_datetime(df['date'])
        df['month'] = df['date'].dt.to_period('M')
        df['date_only'] = df['date'].dt.date
        
        # Basic stats
        received_df = df[df['is_from_me'] == False]
        sent_df = df[df['is_from_me'] == True]
        
        received_count = len(received_df)
        received_words = received_df['word_count'].sum()
        sent_count = len(sent_df)
        sent_words = sent_df['word_count'].sum()
        
        # Display results (anonymized for plots)
        display_name = "Conversation"  # Generic name for plots
        print(f"\nMessage Analysis")
        print("=" * 50)
        print(f"Messages Received: {received_count}")
        print(f"Words Received:    {received_words:,}")
        print(f"Messages Sent:     {sent_count}")
        print(f"Words Sent:        {sent_words:,}")
        print(f"Total Messages:    {received_count + sent_count}")
        print(f"Total Words:       {received_words + sent_words:,}")
        print("=" * 50)
        print("\nGenerating visualizations...")
        
        # Create output directory
        output_dir = Path("imessage_plots")
        output_dir.mkdir(exist_ok=True)
        
        # 1. Words per week for past 6 months
        print("1. Creating words per week chart...")
        six_months_ago = datetime.now() - timedelta(days=180)
        df_recent = df[df['date'] >= six_months_ago].copy()
        df_recent['week'] = df_recent['date'].dt.to_period('W').dt.start_time
        weekly_words = df_recent.groupby('week')['word_count'].sum().reset_index()
        
        plt.figure(figsize=(14, 6))
        plt.plot(weekly_words['week'], weekly_words['word_count'], marker='o', linewidth=2, markersize=6)
        plt.title(f'Words per Week - Past 6 Months ({display_name})', fontsize=14, fontweight='bold')
        plt.xlabel('Week', fontsize=12)
        plt.ylabel('Total Words', fontsize=12)
        plt.xticks(rotation=45)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(output_dir / '1_words_per_week.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 2. Wordcloud (fixed)
        print("2. Creating wordcloud...")
        all_texts = df['text'].dropna().astype(str).tolist()
        cleaned_texts = [clean_text_for_wordcloud(text) for text in all_texts]
        all_text = ' '.join(cleaned_texts)
        # Remove common words and clean
        stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'im', 'ill', 'dont', 'wont', 'cant', 'thats', 'whats', 'wheres', 'hows', 'whys'}
        wordcloud = WordCloud(width=1200, height=600, background_color='white', 
                            stopwords=stopwords, max_words=200, 
                            colormap='viridis', collocations=False).generate(all_text)
        plt.figure(figsize=(14, 7))
        plt.imshow(wordcloud, interpolation='bilinear')
        plt.axis('off')
        plt.title(f'Word Cloud - {display_name}', fontsize=16, fontweight='bold', pad=20)
        plt.tight_layout()
        plt.savefig(output_dir / '2_wordcloud.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 3. Ratio: You vs Her per week
        print("3. Creating conversation ratio chart...")
        df_recent['week'] = df_recent['date'].dt.to_period('W').dt.start_time
        weekly_ratio = df_recent.groupby(['week', 'is_from_me'])['word_count'].sum().unstack(fill_value=0)
        weekly_ratio.columns = ['Them', 'You']
        weekly_ratio['total'] = weekly_ratio.sum(axis=1)
        weekly_ratio['you_ratio'] = weekly_ratio['You'] / weekly_ratio['total']
        weekly_ratio['them_ratio'] = weekly_ratio['Them'] / weekly_ratio['total']
        
        fig, ax = plt.subplots(figsize=(14, 6))
        weeks = weekly_ratio.index
        ax.fill_between(weeks, 0, weekly_ratio['you_ratio'], label='You', alpha=0.7, color='#2ecc71')
        ax.fill_between(weeks, weekly_ratio['you_ratio'], 1, label='Them', alpha=0.7, color='#e74c3c')
        ax.axhline(y=0.5, color='black', linestyle='--', linewidth=1, alpha=0.5)
        ax.set_title(f'Conversation Ratio: You vs Them per Week', fontsize=14, fontweight='bold')
        ax.set_xlabel('Week', fontsize=12)
        ax.set_ylabel('Word Ratio', fontsize=12)
        ax.set_ylim(0, 1)
        ax.legend(loc='best')
        ax.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(output_dir / '3_conversation_ratio.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 4. Streak chart
        print("4. Creating streak chart...")
        df['date_only'] = df['date'].dt.date
        daily_activity = df.groupby('date_only').size().reset_index(name='messages')
        daily_activity['date_only'] = pd.to_datetime(daily_activity['date_only'])
        daily_activity = daily_activity.sort_values('date_only')
        daily_activity['has_message'] = daily_activity['messages'] > 0
        
        # Calculate streaks
        daily_activity['streak_id'] = (daily_activity['has_message'] != daily_activity['has_message'].shift()).cumsum()
        streaks = daily_activity[daily_activity['has_message']].groupby('streak_id').agg({
            'date_only': ['min', 'max', 'count']
        }).reset_index()
        streaks.columns = ['streak_id', 'start', 'end', 'length']
        streaks = streaks.sort_values('length', ascending=False)
        
        plt.figure(figsize=(14, 6))
        for idx, row in streaks.head(10).iterrows():
            plt.barh(idx, (row['end'] - row['start']).days + 1, left=row['start'], 
                    height=0.8, alpha=0.7, color='steelblue')
        plt.xlabel('Date', fontsize=12)
        plt.ylabel('Streak Rank', fontsize=12)
        plt.title(f'Top 10 Message Streaks - {display_name}', fontsize=14, fontweight='bold')
        plt.gca().invert_yaxis()
        longest_streak = streaks.iloc[0] if len(streaks) > 0 else None
        if longest_streak is not None:
            plt.text(0.02, 0.98, f'Longest Streak: {longest_streak["length"]} days\n({longest_streak["start"].date()} to {longest_streak["end"].date()})',
                    transform=plt.gca().transAxes, verticalalignment='top',
                    bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        plt.tight_layout()
        plt.savefig(output_dir / '4_streak_chart.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 5. Heatmap: Hour of day vs Day of week
        print("5. Creating activity heatmap...")
        df['hour'] = df['date'].dt.hour
        df['day_of_week'] = df['date'].dt.day_name()
        day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        df['day_of_week'] = pd.Categorical(df['day_of_week'], categories=day_order, ordered=True)
        heatmap_data = df.groupby(['day_of_week', 'hour']).size().unstack(fill_value=0)
        
        plt.figure(figsize=(14, 8))
        sns.heatmap(heatmap_data, cmap='YlOrRd', annot=True, fmt='d', cbar_kws={'label': 'Message Count'}, 
                   linewidths=0.5, linecolor='gray')
        plt.title(f'Message Activity Heatmap - {display_name}\n(Hour of Day vs Day of Week)', 
                 fontsize=14, fontweight='bold', pad=20)
        plt.xlabel('Hour of Day', fontsize=12)
        plt.ylabel('Day of Week', fontsize=12)
        plt.tight_layout()
        plt.savefig(output_dir / '5_activity_heatmap.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 6. Median response time per month
        print("6. Creating response time charts...")
        df_sorted = df.sort_values('date').reset_index(drop=True)
        monthly_response_times_all = defaultdict(list)
        monthly_response_times_you_to_her = defaultdict(list)
        
        for i in range(1, len(df_sorted)):
            prev_msg = df_sorted.iloc[i-1]
            curr_msg = df_sorted.iloc[i]
            
            # Only calculate if messages are from different senders
            if prev_msg['is_from_me'] != curr_msg['is_from_me']:
                time_diff = (curr_msg['date'] - prev_msg['date']).total_seconds() / 3600  # hours
                if 0 < time_diff < 168:  # Within a week (reasonable response time)
                    month_key = curr_msg['date'].strftime('%Y-%m')
                    monthly_response_times_all[month_key].append(time_diff)
                    
                    # Specifically when you respond to her (prev from her, curr from you)
                    if not prev_msg['is_from_me'] and curr_msg['is_from_me']:
                        monthly_response_times_you_to_her[month_key].append(time_diff)
        
        # Chart 1: All response times
        monthly_medians_all = {month: np.median(times) for month, times in monthly_response_times_all.items()}
        if monthly_medians_all:
            months_all = sorted(monthly_medians_all.keys())
            medians_all = [monthly_medians_all[m] for m in months_all]
            
            plt.figure(figsize=(14, 6))
            plt.plot(months_all, medians_all, marker='o', linewidth=2, markersize=8, color='purple')
            plt.title(f'Median Response Time per Month (All) - {display_name}', fontsize=14, fontweight='bold')
            plt.xlabel('Month', fontsize=12)
            plt.ylabel('Response Time (hours)', fontsize=12)
            plt.xticks(rotation=45)
            plt.grid(True, alpha=0.3)
            plt.tight_layout()
            plt.savefig(output_dir / '6a_response_time_all.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        # Chart 2: Your response times to her
        monthly_medians_you = {month: np.median(times) for month, times in monthly_response_times_you_to_her.items()}
        if monthly_medians_you:
            months_you = sorted(monthly_medians_you.keys())
            medians_you = [monthly_medians_you[m] for m in months_you]
            
            plt.figure(figsize=(14, 6))
            plt.plot(months_you, medians_you, marker='o', linewidth=2, markersize=8, color='#2ecc71')
            plt.title(f'Your Response Time to Them per Month', fontsize=14, fontweight='bold')
            plt.xlabel('Month', fontsize=12)
            plt.ylabel('Response Time (hours)', fontsize=12)
            plt.xticks(rotation=45)
            plt.grid(True, alpha=0.3)
            plt.tight_layout()
            plt.savefig(output_dir / '6b_response_time_you_to_her.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        # Combined chart with both lines
        if monthly_medians_all and monthly_medians_you:
            all_months = sorted(set(list(monthly_medians_all.keys()) + list(monthly_medians_you.keys())))
            medians_all_combined = [monthly_medians_all.get(m, np.nan) for m in all_months]
            medians_you_combined = [monthly_medians_you.get(m, np.nan) for m in all_months]
            
            plt.figure(figsize=(14, 6))
            plt.plot(all_months, medians_all_combined, marker='o', linewidth=2, markersize=8, 
                    color='purple', label='All Response Times', alpha=0.7)
            plt.plot(all_months, medians_you_combined, marker='s', linewidth=2, markersize=8, 
                    color='#2ecc71', label='You → Them', alpha=0.7)
            plt.title(f'Median Response Time Comparison - {display_name}', fontsize=14, fontweight='bold')
            plt.xlabel('Month', fontsize=12)
            plt.ylabel('Response Time (hours)', fontsize=12)
            plt.xticks(rotation=45)
            plt.legend(loc='best')
            plt.grid(True, alpha=0.3)
            plt.tight_layout()
            plt.savefig(output_dir / '6_response_time.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        # 7. Reply ladder analysis
        print("7. Creating reply ladder analysis...")
        df_sorted = df.sort_values('date').reset_index(drop=True)
        
        double_texts_you = 0
        double_texts_them = 0
        conversation_enders_you = 0
        conversation_enders_them = 0
        
        for i in range(len(df_sorted) - 1):
            curr_msg = df_sorted.iloc[i]
            next_msg = df_sorted.iloc[i + 1]
            
            # Check for double texts (same sender, messages within 5 minutes)
            time_diff = (next_msg['date'] - curr_msg['date']).total_seconds() / 60  # minutes
            if time_diff < 5 and curr_msg['is_from_me'] == next_msg['is_from_me']:
                if curr_msg['is_from_me']:
                    double_texts_you += 1
                else:
                    double_texts_them += 1
        
        # Find conversation enders (last message in a sequence)
        # Group consecutive messages from same sender
        df_sorted['sender_group'] = (df_sorted['is_from_me'] != df_sorted['is_from_me'].shift()).cumsum()
        last_in_group = df_sorted.groupby('sender_group').tail(1)
        enders = last_in_group['is_from_me'].value_counts()
        if True in enders.index:
            conversation_enders_you = enders[True]
        if False in enders.index:
            conversation_enders_them = enders[False]
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
        
        # Double texts
        categories = ['You', 'Them']
        double_counts = [double_texts_you, double_texts_them]
        colors = ['#2ecc71', '#e74c3c']
        ax1.bar(categories, double_counts, color=colors, alpha=0.7, edgecolor='black', linewidth=1.5)
        ax1.set_title('Double Texts (Messages < 5 min apart)', fontsize=12, fontweight='bold')
        ax1.set_ylabel('Count', fontsize=11)
        ax1.grid(True, alpha=0.3, axis='y')
        for i, v in enumerate(double_counts):
            ax1.text(i, v + max(double_counts) * 0.01, str(v), ha='center', fontweight='bold')
        
        # Conversation enders
        ender_counts = [conversation_enders_you, conversation_enders_them]
        ax2.bar(categories, ender_counts, color=colors, alpha=0.7, edgecolor='black', linewidth=1.5)
        ax2.set_title('Conversation Enders (Last Message in Sequence)', fontsize=12, fontweight='bold')
        ax2.set_ylabel('Count', fontsize=11)
        ax2.grid(True, alpha=0.3, axis='y')
        for i, v in enumerate(ender_counts):
            ax2.text(i, v + max(ender_counts) * 0.01, str(v), ha='center', fontweight='bold')
        
        plt.suptitle(f'Reply Ladder Analysis - {display_name}', fontsize=14, fontweight='bold')
        plt.tight_layout()
        plt.savefig(output_dir / '7_reply_ladder.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 8. Sentiment trend over time
        print("8. Creating sentiment trend chart...")
        df['week'] = df['date'].dt.to_period('W').dt.start_time
        weekly_sentiment = df.groupby('week')['sentiment'].mean().reset_index()
        weekly_sentiment['rolling'] = weekly_sentiment['sentiment'].rolling(window=4, center=True).mean()
        
        plt.figure(figsize=(14, 6))
        plt.plot(weekly_sentiment['week'], weekly_sentiment['sentiment'], alpha=0.3, color='gray', label='Weekly Average')
        plt.plot(weekly_sentiment['week'], weekly_sentiment['rolling'], linewidth=2, color='purple', label='4-Week Rolling Average')
        plt.axhline(y=0, color='black', linestyle='--', linewidth=1, alpha=0.5)
        plt.title(f'Sentiment Trend Over Time - {display_name}', fontsize=14, fontweight='bold')
        plt.xlabel('Week', fontsize=12)
        plt.ylabel('Sentiment Score (-1 to 1)', fontsize=12)
        plt.legend(loc='best')
        plt.xticks(rotation=45)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(output_dir / '8_sentiment_trend.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 8b. Your sentiment over time
        print("8b. Creating your sentiment over time chart...")
        df_you = df[df['is_from_me'] == True].copy()
        df_you['week'] = df_you['date'].dt.to_period('W').dt.start_time
        weekly_sentiment_you = df_you.groupby('week')['sentiment'].mean().reset_index()
        weekly_sentiment_you['rolling'] = weekly_sentiment_you['sentiment'].rolling(window=4, center=True).mean()
        
        plt.figure(figsize=(14, 6))
        plt.plot(weekly_sentiment_you['week'], weekly_sentiment_you['sentiment'], alpha=0.3, color='gray', label='Weekly Average')
        plt.plot(weekly_sentiment_you['week'], weekly_sentiment_you['rolling'], linewidth=2, color='#2ecc71', label='4-Week Rolling Average')
        plt.axhline(y=0, color='black', linestyle='--', linewidth=1, alpha=0.5)
        plt.title(f'Your Sentiment Over Time - {display_name}', fontsize=14, fontweight='bold')
        plt.xlabel('Week', fontsize=12)
        plt.ylabel('Sentiment Score (-1 to 1)', fontsize=12)
        plt.legend(loc='best')
        plt.xticks(rotation=45)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(output_dir / '8b_sentiment_you_over_time.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 8c. Sentiment comparison: You vs Them
        print("8c. Creating sentiment comparison chart...")
        df_them = df[df['is_from_me'] == False].copy()
        df_them['week'] = df_them['date'].dt.to_period('W').dt.start_time
        weekly_sentiment_them = df_them.groupby('week')['sentiment'].mean().reset_index()
        weekly_sentiment_them['rolling'] = weekly_sentiment_them['sentiment'].rolling(window=4, center=True).mean()
        
        # Combine weeks
        all_weeks = sorted(set(list(weekly_sentiment_you['week']) + list(weekly_sentiment_them['week'])))
        you_dict = dict(zip(weekly_sentiment_you['week'], weekly_sentiment_you['rolling']))
        them_dict = dict(zip(weekly_sentiment_them['week'], weekly_sentiment_them['rolling']))
        you_rolling = [you_dict.get(w, np.nan) for w in all_weeks]
        them_rolling = [them_dict.get(w, np.nan) for w in all_weeks]
        
        plt.figure(figsize=(14, 6))
        plt.plot(all_weeks, you_rolling, marker='o', linewidth=2, markersize=6, 
                color='#2ecc71', label='You', alpha=0.8)
        plt.plot(all_weeks, them_rolling, marker='s', linewidth=2, markersize=6, 
                color='#e74c3c', label='Them', alpha=0.8)
        plt.axhline(y=0, color='black', linestyle='--', linewidth=1, alpha=0.5)
        plt.title(f'Sentiment Comparison: You vs Them', fontsize=14, fontweight='bold')
        plt.xlabel('Week', fontsize=12)
        plt.ylabel('Sentiment Score (-1 to 1)', fontsize=12)
        plt.legend(loc='best')
        plt.xticks(rotation=45)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(output_dir / '8c_sentiment_comparison.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 9. Topics word frequency by month
        print("9. Creating topics word frequency chart...")
        topic_keywords = {
            'travel': ['travel', 'trip', 'flight', 'airport', 'hotel', 'vacation', 'beach', 'plane', 'ticket', 'going', 'visit'],
            'work': ['work', 'office', 'meeting', 'project', 'deadline', 'boss', 'colleague', 'job', 'career', 'business'],
            'food': ['food', 'eat', 'restaurant', 'dinner', 'lunch', 'breakfast', 'cooking', 'recipe', 'hungry', 'meal', 'pizza', 'coffee'],
            'inside_jokes': find_inside_jokes(df, min_repeats=5)
        }
        
        monthly_topics = defaultdict(lambda: defaultdict(int))
        for _, row in df.iterrows():
            month = str(row['month'])
            text_lower = str(row['text']).lower()
            for topic, keywords in topic_keywords.items():
                if topic == 'inside_jokes':
                    for word in keywords.keys():
                        if word in text_lower:
                            monthly_topics[month][topic] += 1
                else:
                    for keyword in keywords:
                        if keyword in text_lower:
                            monthly_topics[month][topic] += 1
                            break
        
        months = sorted(monthly_topics.keys())
        topics_list = ['travel', 'work', 'food', 'inside_jokes']
        topic_data = {topic: [monthly_topics[month].get(topic, 0) for month in months] for topic in topics_list}
        
        plt.figure(figsize=(14, 6))
        x = range(len(months))
        width = 0.2
        colors = ['#3498db', '#e74c3c', '#f39c12', '#9b59b6']
        for i, topic in enumerate(topics_list):
            plt.bar([xi + i*width for xi in x], topic_data[topic], width, label=topic.replace('_', ' ').title(), color=colors[i], alpha=0.7)
        plt.xlabel('Month', fontsize=12)
        plt.ylabel('Frequency', fontsize=12)
        plt.title(f'Topic Word Frequency by Month - {display_name}', fontsize=14, fontweight='bold')
        plt.xticks([xi + width*1.5 for xi in x], months, rotation=45)
        plt.legend(loc='best')
        plt.grid(True, alpha=0.3, axis='y')
        plt.tight_layout()
        plt.savefig(output_dir / '9_topics_by_month.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 10. Word cloud of inside jokes
        print("10. Creating inside jokes wordcloud...")
        inside_jokes = find_inside_jokes(df, min_repeats=5)
        if inside_jokes:
            # Create text from inside jokes
            joke_text = ' '.join([word for word, count in inside_jokes.items() for _ in range(min(count, 20))])
            if joke_text:
                wordcloud_jokes = WordCloud(width=1200, height=600, background_color='white', 
                                           max_words=100, colormap='plasma', collocations=False).generate(joke_text)
                plt.figure(figsize=(14, 7))
                plt.imshow(wordcloud_jokes, interpolation='bilinear')
                plt.axis('off')
                plt.title(f'Inside Jokes Word Cloud - {display_name}', fontsize=16, fontweight='bold', pad=20)
                plt.tight_layout()
                plt.savefig(output_dir / '10_inside_jokes_wordcloud.png', dpi=300, bbox_inches='tight')
                plt.close()
        
        # 11. Compliments vs Logistics
        print("11. Creating compliments vs logistics chart...")
        df['week'] = df['date'].dt.to_period('W').dt.start_time
        weekly_types = df.groupby(['week', 'message_type']).size().unstack(fill_value=0)
        if 'compliment' in weekly_types.columns and 'logistics' in weekly_types.columns:
            weekly_types['total'] = weekly_types['compliment'] + weekly_types['logistics']
            weekly_types['compliment_ratio'] = weekly_types['compliment'] / weekly_types['total'].replace(0, 1)
            weekly_types['logistics_ratio'] = weekly_types['logistics'] / weekly_types['total'].replace(0, 1)
            
            fig, ax = plt.subplots(figsize=(14, 6))
            weeks = weekly_types.index
            ax.fill_between(weeks, 0, weekly_types['compliment_ratio'], label='Compliments/Sweet', alpha=0.7, color='#e74c3c')
            ax.fill_between(weeks, weekly_types['compliment_ratio'], 1, label='Logistics/Coordination', alpha=0.7, color='#3498db')
            ax.axhline(y=0.5, color='black', linestyle='--', linewidth=1, alpha=0.5)
            ax.set_title(f'Compliments vs Logistics Ratio per Week - {display_name}', fontsize=14, fontweight='bold')
            ax.set_xlabel('Week', fontsize=12)
            ax.set_ylabel('Ratio', fontsize=12)
            ax.set_ylim(0, 1)
            ax.legend(loc='best')
            ax.grid(True, alpha=0.3)
            plt.xticks(rotation=45)
            plt.tight_layout()
            plt.savefig(output_dir / '11_compliments_vs_logistics.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        # 12. Top emoji over time
        print("12. Creating top emoji over time chart...")
        all_emojis = []
        for emoji_str in df['emojis'].dropna():
            if emoji_str:
                all_emojis.extend(emoji_str.split())
        emoji_counts = Counter(all_emojis)
        top_emojis = [emoji for emoji, _ in emoji_counts.most_common(5)]
        
        if top_emojis:
            # Get emoji names/descriptions if possible
            def get_emoji_name(emoji_char):
                """Get a readable name for the emoji."""
                if HAS_EMOJI:
                    try:
                        name = emoji.demojize(emoji_char).replace(':', '').replace('_', ' ').title()
                        return f"{emoji_char} ({name})"
                    except:
                        pass
                # Fallback: use unicode name or hex code
                try:
                    import unicodedata
                    name = unicodedata.name(emoji_char, 'Unknown')
                    return f"{emoji_char} ({name})"
                except:
                    hex_code = emoji_char.encode('unicode_escape').decode('ascii')
                    return f"{emoji_char} ({hex_code})"
            
            monthly_emoji = defaultdict(lambda: defaultdict(int))
            for _, row in df.iterrows():
                month = str(row['month'])
                emojis_in_msg = row['emojis'].split() if pd.notna(row['emojis']) and row['emojis'] else []
                for emoji_char in emojis_in_msg:
                    if emoji_char in top_emojis:
                        monthly_emoji[month][emoji_char] += 1
            
            months_emoji = sorted(monthly_emoji.keys())
            emoji_data = {emoji: [monthly_emoji[month].get(emoji, 0) for month in months_emoji] for emoji in top_emojis}
            
            plt.figure(figsize=(14, 6))
            # Try to use a font that supports emojis (macOS)
            try:
                import matplotlib.font_manager as fm
                # Try Apple Color Emoji or other emoji-supporting fonts
                emoji_fonts = ['Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji']
                for font_name in emoji_fonts:
                    try:
                        font_path = fm.findfont(fm.FontProperties(family=font_name))
                        if font_path:
                            plt.rcParams['font.family'] = font_name
                            break
                    except:
                        continue
            except:
                pass
            
            colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6']
            markers = ['o', 's', '^', 'D', 'v']
            for i, emoji_char in enumerate(top_emojis):
                emoji_label = get_emoji_name(emoji_char)
                plt.plot(months_emoji, emoji_data[emoji_char], marker=markers[i % len(markers)], 
                        linewidth=2, markersize=8, label=emoji_label, color=colors[i % len(colors)], alpha=0.8)
            plt.xlabel('Month', fontsize=12)
            plt.ylabel('Frequency', fontsize=12)
            plt.title(f'Top 5 Emoji Over Time - {display_name}', fontsize=14, fontweight='bold')
            plt.legend(loc='best', fontsize=10)
            plt.xticks(rotation=45)
            plt.grid(True, alpha=0.3)
            plt.tight_layout()
            plt.savefig(output_dir / '12_top_emoji_over_time.png', dpi=300, bbox_inches='tight')
            plt.close()
            
            # Reset font to default after this plot
            plt.rcParams['font.family'] = plt.rcParamsDefault['font.family']
        
        # 13. Emoji density per message
        print("13. Creating emoji density chart...")
        df['emoji_density'] = df['emoji_count'] / df['word_count'].replace(0, 1)
        df['week'] = df['date'].dt.to_period('W').dt.start_time
        weekly_emoji_density = df.groupby('week')['emoji_density'].mean().reset_index()
        
        plt.figure(figsize=(14, 6))
        plt.plot(weekly_emoji_density['week'], weekly_emoji_density['emoji_density'], marker='o', linewidth=2, markersize=6, color='orange')
        plt.title(f'Emoji Density per Message Over Time - {display_name}', fontsize=14, fontweight='bold')
        plt.xlabel('Week', fontsize=12)
        plt.ylabel('Emojis per Word (average)', fontsize=12)
        plt.xticks(rotation=45)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(output_dir / '13_emoji_density.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 13b. Emoji statistics (text output)
        print("\n" + "=" * 60)
        print("EMOJI STATISTICS")
        print("=" * 60)
        
        def get_emoji_name(emoji_char):
            """Get a readable name for the emoji."""
            if HAS_EMOJI:
                try:
                    name = emoji.demojize(emoji_char).replace(':', '').replace('_', ' ').title()
                    return name
                except:
                    pass
            # Fallback: use unicode name
            try:
                import unicodedata
                name = unicodedata.name(emoji_char, 'Unknown')
                return name
            except:
                return 'Unknown'
        
        # Combined emoji stats
        all_emojis_combined = []
        for emoji_str in df['emojis'].dropna():
            if emoji_str:
                all_emojis_combined.extend(emoji_str.split())
        emoji_counts_combined = Counter(all_emojis_combined)
        total_emojis_combined = sum(emoji_counts_combined.values())
        
        print(f"\n📊 COMBINED EMOJI STATISTICS (Both of You)")
        print("-" * 60)
        print(f"Total Emojis Used: {total_emojis_combined:,}")
        print(f"Unique Emojis: {len(emoji_counts_combined)}")
        print(f"\nTop 20 Most Used Emojis:")
        for i, (emoji_char, count) in enumerate(emoji_counts_combined.most_common(20), 1):
            emoji_name = get_emoji_name(emoji_char)
            percentage = (count / total_emojis_combined * 100) if total_emojis_combined > 0 else 0
            print(f"  {i:2d}. {emoji_char:3s} {emoji_name:40s} - {count:5d} times ({percentage:5.2f}%)")
        
        # Your emoji stats
        df_you_emoji = df[df['is_from_me'] == True]
        all_emojis_you = []
        for emoji_str in df_you_emoji['emojis'].dropna():
            if emoji_str:
                all_emojis_you.extend(emoji_str.split())
        emoji_counts_you = Counter(all_emojis_you)
        total_emojis_you = sum(emoji_counts_you.values())
        
        print(f"\n👤 YOUR EMOJI STATISTICS")
        print("-" * 60)
        print(f"Total Emojis Used: {total_emojis_you:,}")
        print(f"Unique Emojis: {len(emoji_counts_you)}")
        print(f"Average Emojis per Message: {total_emojis_you / len(df_you_emoji) if len(df_you_emoji) > 0 else 0:.2f}")
        print(f"\nTop 20 Most Used Emojis (You):")
        for i, (emoji_char, count) in enumerate(emoji_counts_you.most_common(20), 1):
            emoji_name = get_emoji_name(emoji_char)
            percentage = (count / total_emojis_you * 100) if total_emojis_you > 0 else 0
            print(f"  {i:2d}. {emoji_char:3s} {emoji_name:40s} - {count:5d} times ({percentage:5.2f}%)")
        
        # Her emoji stats
        df_them_emoji = df[df['is_from_me'] == False]
        all_emojis_them = []
        for emoji_str in df_them_emoji['emojis'].dropna():
            if emoji_str:
                all_emojis_them.extend(emoji_str.split())
        emoji_counts_them = Counter(all_emojis_them)
        total_emojis_them = sum(emoji_counts_them.values())
        
        print(f"\n👥 THEIR EMOJI STATISTICS")
        print("-" * 60)
        print(f"Total Emojis Used: {total_emojis_them:,}")
        print(f"Unique Emojis: {len(emoji_counts_them)}")
        print(f"Average Emojis per Message: {total_emojis_them / len(df_them_emoji) if len(df_them_emoji) > 0 else 0:.2f}")
        print(f"\nTop 20 Most Used Emojis (Them):")
        for i, (emoji_char, count) in enumerate(emoji_counts_them.most_common(20), 1):
            emoji_name = get_emoji_name(emoji_char)
            percentage = (count / total_emojis_them * 100) if total_emojis_them > 0 else 0
            print(f"  {i:2d}. {emoji_char:3s} {emoji_name:40s} - {count:5d} times ({percentage:5.2f}%)")
        
        # Comparison
        print(f"\n📈 EMOJI COMPARISON")
        print("-" * 60)
        print(f"Total Emojis - You: {total_emojis_you:,} | Them: {total_emojis_them:,}")
        if total_emojis_combined > 0:
            you_percentage = (total_emojis_you / total_emojis_combined * 100)
            them_percentage = (total_emojis_them / total_emojis_combined * 100)
            print(f"Percentage - You: {you_percentage:.1f}% | Them: {them_percentage:.1f}%")
        
        # Find emojis unique to each person
        emojis_only_you = set(emoji_counts_you.keys()) - set(emoji_counts_them.keys())
        emojis_only_them = set(emoji_counts_them.keys()) - set(emoji_counts_you.keys())
        emojis_shared = set(emoji_counts_you.keys()) & set(emoji_counts_them.keys())
        
        print(f"\nEmojis Only You Use: {len(emojis_only_you)}")
        if emojis_only_you:
            top_only_you = sorted([(emoji_counts_you[e], e) for e in emojis_only_you], reverse=True)[:10]
            for count, emoji_char in top_only_you:
                emoji_name = get_emoji_name(emoji_char)
                print(f"  {emoji_char:3s} {emoji_name:40s} - {count} times")
        
        print(f"\nEmojis Only They Use: {len(emojis_only_them)}")
        if emojis_only_them:
            top_only_them = sorted([(emoji_counts_them[e], e) for e in emojis_only_them], reverse=True)[:10]
            for count, emoji_char in top_only_them:
                emoji_name = get_emoji_name(emoji_char)
                print(f"  {emoji_char:3s} {emoji_name:40s} - {count} times")
        
        print(f"\nShared Emojis: {len(emojis_shared)}")
        if emojis_shared:
            # Show emojis where usage differs significantly
            shared_comparison = []
            for emoji_char in emojis_shared:
                you_count = emoji_counts_you.get(emoji_char, 0)
                them_count = emoji_counts_them.get(emoji_char, 0)
                total_shared = you_count + them_count
                if total_shared > 0:
                    you_pct = (you_count / total_shared * 100)
                    them_pct = (them_count / total_shared * 100)
                    shared_comparison.append((total_shared, emoji_char, you_count, them_count, you_pct, them_pct))
            
            shared_comparison.sort(reverse=True)
            print(f"\nTop 15 Shared Emojis (with usage breakdown):")
            for total, emoji_char, you_count, them_count, you_pct, them_pct in shared_comparison[:15]:
                emoji_name = get_emoji_name(emoji_char)
                print(f"  {emoji_char:3s} {emoji_name:35s} - Total: {total:4d} | You: {you_count:3d} ({you_pct:5.1f}%) | Them: {them_count:3d} ({them_pct:5.1f}%)")
        
        print("=" * 60 + "\n")
        
        # 14. First appearances
        print("14. Creating first appearances chart...")
        first_appearances = {}
        milestones = {
            'love you': ['love you', 'i love you', 'love u'],
            'heart': ['❤️', '💕', '💖', '💗', '💓'],
            'pet_name': ['babe', 'baby', 'honey', 'sweetie', 'darling', 'dear']
        }
        
        for milestone, keywords in milestones.items():
            for _, row in df.sort_values('date').iterrows():
                text_lower = str(row['text']).lower()
                text_full = str(row['text'])
                if milestone == 'heart':
                    # Check both text and emojis column
                    emojis_in_msg = str(row.get('emojis', ''))
                    if any(emoji in text_full for emoji in keywords) or any(emoji in emojis_in_msg for emoji in keywords):
                        first_appearances[milestone] = row['date']
                        break
                else:
                    if any(keyword in text_lower for keyword in keywords):
                        first_appearances[milestone] = row['date']
                        break
        
        if first_appearances:
            fig, ax = plt.subplots(figsize=(12, 6))
            milestones_list = list(first_appearances.keys())
            dates_list = [first_appearances[m] for m in milestones_list]
            colors_list = ['#e74c3c', '#f39c12', '#9b59b6']
            
            for i, (milestone, date) in enumerate(first_appearances.items()):
                ax.scatter(date, i, s=200, color=colors_list[i % len(colors_list)], alpha=0.7, edgecolors='black', linewidth=2)
                ax.text(date, i, f'  {milestone.replace("_", " ").title()}', va='center', fontsize=11, fontweight='bold')
            
            ax.set_yticks(range(len(milestones_list)))
            ax.set_yticklabels([m.replace('_', ' ').title() for m in milestones_list])
            ax.set_xlabel('Date', fontsize=12)
            ax.set_title(f'First Appearances - {display_name}', fontsize=14, fontweight='bold')
            ax.grid(True, alpha=0.3, axis='x')
            plt.tight_layout()
            plt.savefig(output_dir / '14_first_appearances.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        # 15. Big day detector
        print("15. Creating big day detector...")
        daily_volume = df.groupby('date_only').agg({
            'word_count': 'sum',
            'text': 'count'
        }).reset_index()
        daily_volume.columns = ['date', 'total_words', 'message_count']
        daily_volume['date'] = pd.to_datetime(daily_volume['date'])
        
        # Find outliers (days with unusually high volume)
        q75_words = daily_volume['total_words'].quantile(0.75)
        q25_words = daily_volume['total_words'].quantile(0.25)
        iqr_words = q75_words - q25_words
        threshold_words = q75_words + 1.5 * iqr_words
        
        big_days = daily_volume[daily_volume['total_words'] > threshold_words].sort_values('total_words', ascending=False).head(10)
        
        if len(big_days) > 0:
            plt.figure(figsize=(14, 6))
            plt.barh(range(len(big_days)), big_days['total_words'], color='coral', alpha=0.7, edgecolor='black')
            plt.yticks(range(len(big_days)), [d.strftime('%Y-%m-%d') for d in big_days['date']])
            plt.xlabel('Total Words', fontsize=12)
            plt.ylabel('Date', fontsize=12)
            plt.title(f'Big Days Detector - Top 10 Outlier Days by Volume - {display_name}', fontsize=14, fontweight='bold')
            plt.gca().invert_yaxis()
            for i, (idx, row) in enumerate(big_days.iterrows()):
                plt.text(row['total_words'] + max(big_days['total_words']) * 0.01, i, 
                        f"{int(row['total_words'])} words, {int(row['message_count'])} msgs", 
                        va='center', fontsize=9)
            plt.grid(True, alpha=0.3, axis='x')
            plt.tight_layout()
            plt.savefig(output_dir / '15_big_day_detector.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        # 16. Argument fingerprint
        print("16. Creating argument fingerprint analysis...")
        df_sorted = df.sort_values('date').reset_index(drop=True)
        df_sorted['time_since_prev'] = df_sorted['date'].diff().dt.total_seconds() / 60  # minutes
        df_sorted['rapid_response'] = df_sorted['time_since_prev'] < 5  # within 5 minutes
        df_sorted['long_message'] = df_sorted['word_count'] > 20
        df_sorted['low_emoji'] = df_sorted['emoji_density'] < 0.05
        df_sorted['low_sentiment'] = df_sorted['sentiment'] < -0.1
        
        # Group into conversation threads (messages within 30 minutes)
        df_sorted['thread_id'] = (df_sorted['time_since_prev'] > 30).cumsum()
        
        thread_analysis = df_sorted.groupby('thread_id').agg({
            'rapid_response': 'sum',
            'long_message': 'sum',
            'low_emoji': 'mean',
            'low_sentiment': 'mean',
            'word_count': 'sum',
            'date': 'min'
        }).reset_index()
        
        thread_analysis['argument_score'] = (
            thread_analysis['rapid_response'] * 0.3 +
            thread_analysis['long_message'] * 0.2 +
            thread_analysis['low_emoji'] * 0.3 +
            (thread_analysis['low_sentiment'] < -0.1).astype(int) * 0.2
        )
        
        argument_threads = thread_analysis[thread_analysis['argument_score'] > 0.5].sort_values('argument_score', ascending=False).head(10)
        
        if len(argument_threads) > 0:
            plt.figure(figsize=(14, 6))
            plt.barh(range(len(argument_threads)), argument_threads['argument_score'], 
                    color='darkred', alpha=0.7, edgecolor='black')
            plt.yticks(range(len(argument_threads)), 
                      [d.strftime('%Y-%m-%d') for d in argument_threads['date']])
            plt.xlabel('Argument Score', fontsize=12)
            plt.ylabel('Date', fontsize=12)
            plt.title(f'Argument Fingerprint - Potential Arguments - {display_name}', fontsize=14, fontweight='bold')
            plt.gca().invert_yaxis()
            plt.grid(True, alpha=0.3, axis='x')
            plt.tight_layout()
            plt.savefig(output_dir / '16_argument_fingerprint.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        # 17. Travel mode (simplified - using message timing patterns)
        print("17. Creating travel mode analysis...")
        # Detect potential travel by looking at gaps in messaging (travel days)
        df_sorted = df.sort_values('date').reset_index(drop=True)
        df_sorted['days_since_prev'] = df_sorted['date'].diff().dt.days
        
        # Days with no messages might indicate travel
        all_dates = pd.date_range(df['date'].min(), df['date'].max(), freq='D')
        message_dates = set(df['date_only'].unique())
        quiet_days = [d for d in all_dates if d.date() not in message_dates]
        
        # Group into periods: high activity vs low activity (potential travel)
        weekly_activity = df.groupby(df['date'].dt.to_period('W')).agg({
            'word_count': 'sum',
            'text': 'count'
        })
        
        q25 = weekly_activity['word_count'].quantile(0.25)
        q75 = weekly_activity['word_count'].quantile(0.75)
        
        travel_weeks = weekly_activity[weekly_activity['word_count'] < q25].index
        active_weeks = weekly_activity[weekly_activity['word_count'] > q75].index
        
        if len(travel_weeks) > 0 and len(active_weeks) > 0:
            fig, ax = plt.subplots(figsize=(14, 6))
            travel_volumes = [weekly_activity.loc[week, 'word_count'] for week in travel_weeks]
            active_volumes = [weekly_activity.loc[week, 'word_count'] for week in active_weeks]
            
            ax.scatter([str(w) for w in travel_weeks], travel_volumes, 
                      s=100, alpha=0.6, color='orange', label='Low Activity (Possible Travel)', edgecolors='black')
            ax.scatter([str(w) for w in active_weeks], active_volumes, 
                      s=100, alpha=0.6, color='green', label='High Activity', edgecolors='black')
            
            ax.set_xlabel('Week', fontsize=12)
            ax.set_ylabel('Total Words', fontsize=12)
            ax.set_title(f'Travel Mode Analysis - Activity Patterns - {display_name}', fontsize=14, fontweight='bold')
            ax.legend(loc='best')
            plt.xticks(rotation=45)
            ax.grid(True, alpha=0.3)
            plt.tight_layout()
            plt.savefig(output_dir / '17_travel_mode.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        print(f"\n✓ All visualizations saved to '{output_dir}/' directory!")
        print(f"  - 1_words_per_week.png")
        print(f"  - 2_wordcloud.png (fixed)")
        print(f"  - 3_conversation_ratio.png")
        print(f"  - 4_streak_chart.png")
        print(f"  - 5_activity_heatmap.png")
        print(f"  - 6_response_time.png (combined)")
        print(f"  - 6a_response_time_all.png (all response times)")
        print(f"  - 6b_response_time_you_to_her.png (you responding to her)")
        print(f"  - 7_reply_ladder.png")
        print(f"  - 8_sentiment_trend.png (all messages)")
        print(f"  - 8b_sentiment_you_over_time.png (your sentiment)")
        print(f"  - 8c_sentiment_comparison.png (you vs them)")
        print(f"  - 9_topics_by_month.png")
        print(f"  - 10_inside_jokes_wordcloud.png")
        print(f"  - 11_compliments_vs_logistics.png")
        print(f"  - 12_top_emoji_over_time.png")
        print(f"  - 13_emoji_density.png")
        print(f"  - 14_first_appearances.png")
        print(f"  - 15_big_day_detector.png")
        print(f"  - 16_argument_fingerprint.png")
        print(f"  - 17_travel_mode.png")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Analyze iMessage history for a specific contact and generate visualizations.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s "+1 (123) 456-7890"
  %(prog)s "+1 (123) 456-7890" --name "Contact Name"
  %(prog)s "+11234567890" --name "Friend"
        """
    )
    parser.add_argument(
        'phone_number',
        type=str,
        help='Phone number to analyze (e.g., "+1 (123) 456-7890" or "+11234567890")'
    )
    parser.add_argument(
        '--name',
        '--contact-name',
        type=str,
        dest='contact_name',
        default=None,
        help='Optional contact name (for internal reference only, not shown in plots)'
    )
    
    args = parser.parse_args()
    
    print(f"Starting iMessage analysis...")
    print(f"Phone number: {args.phone_number}")
    if args.contact_name:
        print(f"Contact name: {args.contact_name}")
    print()
    
    analyze_imessage_contact(args.phone_number, args.contact_name)
