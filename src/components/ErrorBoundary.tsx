import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      const {
        fallbackTitle = 'Bu araçta beklenmeyen bir hata oluştu',
        fallbackMessage = 'Araç çalışırken bir sorunla karşılaşıldı. Uygulama genelinde sorun bulunmamaktadır.',
      } = this.props;

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
            </View>

            <Text style={styles.title}>{fallbackTitle}</Text>
            <Text style={styles.message}>{fallbackMessage}</Text>

            {this.state.error && (
              <View style={styles.errorDetailBox}>
                <Text style={styles.errorDetailText} numberOfLines={3}>
                  {this.state.error.message}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.handleReset}
              accessibilityRole="button"
              accessibilityLabel="Tekrar dene"
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.retryText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  content: {
    maxWidth: 400,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  errorDetailBox: {
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    marginBottom: 20,
  },
  errorDetailText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#DC2626',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
});
