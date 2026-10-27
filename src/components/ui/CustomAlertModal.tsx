import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { GradientView } from './GradientView';
import { borderRadius, colors, spacing } from '@/theme/tokens';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomAlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onClose?: () => void;
  icon?: string;
  children?: React.ReactNode;
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  visible,
  title,
  message,
  buttons = [{ text: 'CONFIRM' }],
  onClose,
  icon,
  children,
}) => {
  if (!visible) return null;

  const defaultIcon = title.toLowerCase().includes('saved') || title.toLowerCase().includes('success')
    ? '🎯'
    : title.toLowerCase().includes('delete') || title.toLowerCase().includes('remove') || title.toLowerCase().includes('leave')
    ? '⚠️'
    : '🔔';

  const displayIcon = icon || defaultIcon;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.dialogCard}>
              {/* Header Icon Badge */}
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>{displayIcon}</Text>
              </View>

              {/* Title & Description */}
              <Text style={styles.titleText}>{title}</Text>
              {message ? <Text style={styles.messageText}>{message}</Text> : null}
              {children}

              {/* Action Buttons */}
              <View style={[styles.buttonsRow, buttons.length === 1 && styles.singleButtonRow]}>
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';

                  if (isCancel) {
                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.cancelBtn}
                        onPress={() => {
                          btn.onPress?.();
                          onClose?.();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cancelBtnText}>{btn.text.toUpperCase()}</Text>
                      </TouchableOpacity>
                    );
                  }

                  if (isDestructive) {
                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.destructiveBtn}
                        onPress={() => {
                          btn.onPress?.();
                          onClose?.();
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.destructiveBtnText}>{btn.text.toUpperCase()}</Text>
                      </TouchableOpacity>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.confirmBtnWrapper}
                      onPress={() => {
                        btn.onPress?.();
                        onClose?.();
                      }}
                      activeOpacity={0.85}
                    >
                      <GradientView
                        borderRadius={14}
                        colors={['#DE3B7E', '#F45B36']}
                        style={styles.confirmBtnGradient}
                      >
                        <Text style={styles.confirmBtnText}>{btn.text.toUpperCase()}</Text>
                      </GradientView>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  iconText: {
    fontSize: 24,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  buttonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 20,
  },
  singleButtonRow: {
    justifyContent: 'center',
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  destructiveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  confirmBtnWrapper: {
    flex: 1,
    height: 46,
  },
  confirmBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
