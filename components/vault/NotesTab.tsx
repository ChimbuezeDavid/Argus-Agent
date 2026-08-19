import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as notesRepo from '@/services/database/notesRepo';
import { useHCITheme } from '@/hooks/useHCITheme';

import { EmptyState } from '@/components/shared/EmptyState';
import { ModalSheet } from '@/components/shared/ModalSheet';

interface NotesTabProps {
  refreshSignal: number;
}

export default function NotesTab({ refreshSignal }: NotesTabProps) {
  const { colors, scaleFont } = useHCITheme();

  const [notes, setNotes] = useState<notesRepo.Note[]>([]);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteTitleInput, setNoteTitleInput] = useState('');
  const [noteContentInput, setNoteContentInput] = useState('');
  const [noteTagsInput, setNoteTagsInput] = useState('');
  const [noteIsPinned, setNoteIsPinned] = useState(false);

  const fetchNotes = useCallback(async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const notesList = await notesRepo.listNotes(
          noteSearchQuery || undefined,
          selectedTag ? [selectedTag] : undefined
        );
        setNotes(notesList);
        break;
      } catch (e) {
        if (attempt === 3) {
          console.warn('Error fetching notes after 3 attempts:', e);
        } else {
          await new Promise((r) => setTimeout(r, 150 * attempt));
        }
      }
    }
    setRefreshing(false);
  }, [noteSearchQuery, selectedTag]);

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [fetchNotes])
  );

  useEffect(() => {
    if (refreshSignal > 0) {
      fetchNotes();
    }
  }, [refreshSignal, fetchNotes]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotes();
  };

  const handleOpenCreateNote = () => {
    setEditingNoteId(null);
    setNoteTitleInput('');
    setNoteContentInput('');
    setNoteTagsInput('');
    setNoteIsPinned(false);
    setNoteModalVisible(true);
  };

  const handleOpenEditNote = (note: notesRepo.Note) => {
    setEditingNoteId(note.id);
    setNoteTitleInput(note.title);
    setNoteContentInput(note.content);
    setNoteTagsInput(note.tags.join(', '));
    setNoteIsPinned(!!note.is_pinned);
    setNoteModalVisible(true);
  };

  const handleSaveNote = async () => {
    if (!noteTitleInput.trim() || !noteContentInput.trim()) {
      Alert.alert('Validation', 'Title and content are required.');
      return;
    }
    const tags = noteTagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      if (editingNoteId) {
        await notesRepo.updateNote(editingNoteId, {
          title: noteTitleInput.trim(),
          content: noteContentInput.trim(),
          tags,
          isPinned: noteIsPinned,
        });
      } else {
        await notesRepo.createNote(
          noteTitleInput.trim(),
          noteContentInput.trim(),
          tags,
          noteIsPinned
        );
      }
      setNoteModalVisible(false);
      fetchNotes();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteNote = (id: number) => {
    Alert.alert('Delete Note', 'Delete this note permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await notesRepo.deleteNote(id);
          fetchNotes();
        },
      },
    ]);
  };

  const handleTogglePinNote = async (note: notesRepo.Note) => {
    await notesRepo.updateNote(note.id, { isPinned: !note.is_pinned });
    fetchNotes();
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet);
  }, [notes]);

  return (
    <View style={styles.tabContainer}>
      {/* 1. Search Bar */}
      <View style={[styles.searchBarWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.primary} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.text, fontSize: scaleFont(13) }]}
          value={noteSearchQuery}
          onChangeText={setNoteSearchQuery}
          placeholder="Search notes, ideas, code snippets..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* 2. Filter Tags & New Note Action Row */}
      <View style={styles.actionFilterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsHorizon}>
          <TouchableOpacity
            style={[
              styles.tagPill,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedTag === null && [styles.tagPillActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
            ]}
            onPress={() => setSelectedTag(null)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tagPillText,
                { color: selectedTag === null ? colors.primary : colors.textSecondary, fontSize: scaleFont(12) },
              ]}
            >
              All ({notes.length})
            </Text>
          </TouchableOpacity>
          {allTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tagPill,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selectedTag === tag && [styles.tagPillActive, { backgroundColor: colors.primaryBg, borderColor: colors.primary }],
              ]}
              onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tagPillText,
                  { color: selectedTag === tag ? colors.primary : colors.textSecondary, fontSize: scaleFont(12) },
                ]}
              >
                #{tag}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={handleOpenCreateNote}
          activeOpacity={0.8}
        >
          <Text style={[styles.createBtnText, { color: '#ffffff', fontSize: scaleFont(12) }]}>+ New Note</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Note Cards Stream */}
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.notesListContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title="Vault Empty"
            subtitle={noteSearchQuery ? 'No notes matched your search query.' : 'Create your first note or ask Argus Agent to capture a memory.'}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.noteCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              item.is_pinned && [styles.noteCardPinned, { borderColor: colors.primary }],
            ]}
            onPress={() => handleOpenEditNote(item)}
            activeOpacity={0.8}
          >
            <View style={styles.noteTopRow}>
              <Text style={[styles.noteTitle, { color: colors.text, fontSize: scaleFont(15) }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.cardActionGroup}>
                <TouchableOpacity
                  onPress={() => handleTogglePinNote(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginRight: 12 }}
                >
                  <Ionicons
                    name="pin"
                    size={16}
                    color={item.is_pinned ? '#f43f5e' : colors.textMuted}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteNote(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.noteContent, { color: colors.textSecondary, fontSize: scaleFont(13) }]} numberOfLines={3}>
              {item.content}
            </Text>

            <View style={styles.noteFooter}>
              <View style={styles.tagsContainer}>
                {item.tags.map((t) => (
                  <View key={t} style={[styles.cardTag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.cardTagText, { color: colors.primary, fontSize: scaleFont(11) }]}>#{t}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.noteDate, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
                {new Date(item.updated_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Note Editor Modal */}
      <ModalSheet
        visible={noteModalVisible}
        onClose={() => setNoteModalVisible(false)}
        title={editingNoteId ? 'Edit Knowledge Note' : 'Create Knowledge Note'}
      >
        <TextInput
          style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Note title..."
          placeholderTextColor={colors.textMuted}
          value={noteTitleInput}
          onChangeText={setNoteTitleInput}
        />
        <TextInput
          style={[styles.modalTextArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Write your note, idea, meeting summary..."
          placeholderTextColor={colors.textMuted}
          value={noteContentInput}
          onChangeText={setNoteContentInput}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <TextInput
          style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Tags (comma separated, e.g. idea, project, meeting)"
          placeholderTextColor={colors.textMuted}
          value={noteTagsInput}
          onChangeText={setNoteTagsInput}
        />

        <TouchableOpacity
          style={styles.pinToggleRow}
          onPress={() => setNoteIsPinned(!noteIsPinned)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={noteIsPinned ? 'pin' : 'pin-outline'}
            size={18}
            color={noteIsPinned ? '#f43f5e' : colors.textMuted}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.pinToggleText, { color: noteIsPinned ? '#f43f5e' : colors.textSecondary }]}>
            {noteIsPinned ? 'Pinned to top of Vault' : 'Pin note to top'}
          </Text>
        </TouchableOpacity>

        <View style={styles.modalBtnRow}>
          <TouchableOpacity
            style={[styles.modalBtnCancel, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setNoteModalVisible(false)}
            activeOpacity={0.8}
          >
            <Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalBtnConfirm, { backgroundColor: colors.primary }]}
            onPress={handleSaveNote}
            activeOpacity={0.8}
          >
            <Text style={styles.modalBtnConfirmText}>
              {editingNoteId ? 'Save Changes' : 'Create Note'}
            </Text>
          </TouchableOpacity>
        </View>
      </ModalSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flex: 1,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#f8fafc',
  },
  actionFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  tagsHorizon: {
    flex: 1,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginRight: 6,
  },
  tagPillActive: {
    backgroundColor: '#0c1a2e',
    borderColor: '#0284c7',
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tagPillTextActive: {
    color: '#38bdf8',
  },
  createBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#022c22',
  },
  notesListContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
  },
  noteCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
  },
  noteCardPinned: {
    borderColor: '#0284c7',
  },
  noteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
    flex: 1,
    marginRight: 10,
  },
  cardActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteContent: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 12,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  cardTag: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  noteDate: {
    fontSize: 11,
    color: '#64748b',
  },
  modalInput: {
    backgroundColor: '#090d16',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#f8fafc',
    marginBottom: 10,
  },
  modalTextArea: {
    backgroundColor: '#090d16',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#f8fafc',
    minHeight: 110,
    marginBottom: 10,
  },
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  pinToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  modalBtnConfirm: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
