// Systems Check Modal Component
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { COLORS, FONTS } from '../constants/Theme';

interface SystemsCheckModalProps {
  visible: boolean;
  onClose: () => void;
  logs: string[];
  running: boolean;
  onRunChecks: () => void;
  scrollRef: React.RefObject<ScrollView>;
}

export function SystemsCheckModal({
  visible,
  onClose,
  logs,
  running,
  onRunChecks,
  scrollRef,
}: SystemsCheckModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>SYSTEMS CHECK</Text>
          </View>
          
          <ScrollView 
            ref={scrollRef}
            style={styles.log}
            contentContainerStyle={styles.logContent}
          >
            {logs.map((line, idx) => (
              <Text 
                key={idx} 
                style={[
                  styles.logLine,
                  (line.includes('✗') || line.includes('FAILED') || line.includes('CRITICAL')) && styles.failedLine
                ]}
              >
                {line}
              </Text>
            ))}
          </ScrollView>
          
          <View style={styles.footer}>
            {!running && (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.buttonRun]}
                  onPress={onRunChecks}
                >
                  <Text style={styles.buttonText}>RUN CHECK</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonClose]}
                  onPress={onClose}
                >
                  <Text style={styles.buttonText}>CLOSE</Text>
                </TouchableOpacity>
              </>
            )}
            {running && (
              <View style={styles.status}>
                <ActivityIndicator size="small" color={COLORS.accent} />
                <Text style={styles.statusText}>RUNNING...</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  modal: {
    width: '100%',
    maxWidth: 600,
    height: '85%',
    backgroundColor: COLORS.panel,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.accent,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#121926',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  title: {
    fontSize: 18,
    color: COLORS.accent,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
  },
  log: {
    flex: 1,
    backgroundColor: '#05070a',
    padding: 12,
  },
  logContent: {
    paddingBottom: 20,
  },
  logLine: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: FONTS.monospace,
    lineHeight: 18,
    marginBottom: 2,
  },
  failedLine: {
    color: COLORS.alert,
  },
  footer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#121926',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonRun: {
    backgroundColor: COLORS.accent,
    borderColor: '#00a843',
  },
  buttonClose: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.border,
  },
  buttonText: {
    fontSize: 12,
    color: COLORS.background,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
  status: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  statusText: {
    fontSize: 12,
    color: COLORS.accent,
    fontFamily: FONTS.monospace,
    fontWeight: 'bold',
  },
});

