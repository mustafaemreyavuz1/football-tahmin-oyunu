import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

export interface SearchSuggestion {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  suggestions?: SearchSuggestion[];
  onSelectSuggestion?: (item: SearchSuggestion) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder,
  suggestions = [],
  onSelectSuggestion,
  onSubmit,
  submitLabel,
  disabled = false,
  autoFocus = false,
}: SearchInputProps) {
  const { tokens } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: tokens.surface,
            borderColor: value.length > 0 ? tokens.accent : tokens.border,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={tokens.textMuted} style={styles.searchIcon} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.textMuted}
          editable={!disabled}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          style={[styles.input, { color: tokens.text }]}
        />
        {value.length > 0 && !disabled && (
          <Pressable
            onPress={() => onChangeText('')}
            style={styles.clearBtn}
            accessibilityLabel="Temizle"
          >
            <Ionicons name="close-circle" size={18} color={tokens.textMuted} />
          </Pressable>
        )}
        {submitLabel && onSubmit && (
          <Pressable
            onPress={onSubmit}
            disabled={disabled || !value.trim()}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: tokens.accent,
                opacity: disabled || !value.trim() ? 0.45 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.submitText, { color: tokens.accentText }]}>{submitLabel}</Text>
          </Pressable>
        )}
      </View>

      {suggestions.length > 0 && onSelectSuggestion && !disabled && (
        <View
          style={[
            styles.dropdown,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={styles.dropdownList}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => onSelectSuggestion(item)}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  {
                    backgroundColor: pressed ? tokens.accentSoft : 'transparent',
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: tokens.border,
                  },
                ]}
              >
                <Text style={[styles.suggestionLabel, { color: tokens.text }]}>{item.label}</Text>
                {item.sublabel ? (
                  <Text style={[styles.suggestionSub, { color: tokens.textMuted }]}>
                    {item.sublabel}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  clearBtn: {
    padding: 6,
  },
  submitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    marginLeft: 4,
  },
  submitText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 220,
  },
  dropdownList: {
    maxHeight: 220,
  },
  suggestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  suggestionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionSub: {
    fontSize: 12,
  },
});
