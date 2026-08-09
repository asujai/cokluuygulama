import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../../core/theme';
import { ProcessMode, SelectedFile } from './types';
import {
  encryptBuffer,
  decryptBuffer,
  saveAndExportFile,
  uint8ArrayToBase64,
  base64ToUint8Array,
  uint8ArrayToString,
} from './encryptionService';

export const FileEncryptionTool: React.FC = () => {
  const { theme, spacing, borderRadius, typography } = useTheme();

  const [mode, setMode] = useState<ProcessMode>('encrypt');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [textInput, setTextInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);

  const handlePickFile = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setDecryptedText(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          name: asset.name,
          size: asset.size ?? 0,
          uri: asset.uri,
          mimeType: asset.mimeType,
        });
      }
    } catch (err) {
      setErrorMessage('Dosya seçimi sırasında hata oluştu.');
    }
  };

  const calculatePasswordStrength = (pw: string) => {
    if (!pw) return { score: 0, label: 'Parola Giriniz', color: theme.textMuted };
    if (pw.length < 6) return { score: 1, label: 'Zayıf (En az 6 karakter)', color: theme.error };
    const hasNum = /\d/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    if (pw.length >= 10 && hasNum && hasSpecial) {
      return { score: 3, label: 'Güçlü (AES-GCM 256)', color: theme.success };
    }
    return { score: 2, label: 'Orta', color: theme.warning };
  };

  const pwdStrength = calculatePasswordStrength(password);

  const readFileBytes = async (file: SelectedFile): Promise<Uint8Array> => {
    if (Platform.OS === 'web') {
      const res = await fetch(file.uri);
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } else {
      const b64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64ToUint8Array(b64);
    }
  };

  const handleProcess = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setDecryptedText(null);

    if (!password) {
      setErrorMessage('Lütfen işlemi gerçekleştirmek için bir parola belirleyin.');
      return;
    }

    if (!selectedFile && !textInput.trim()) {
      setErrorMessage('Lütfen işlem yapılacak bir dosya seçin veya metin girin.');
      return;
    }

    setIsProcessing(true);

    try {
      let inputData: Uint8Array;
      let targetFileName = 'encrypted_data.enc';

      if (selectedFile) {
        inputData = await readFileBytes(selectedFile);
        if (mode === 'encrypt') {
          targetFileName = `${selectedFile.name}.enc`;
        } else {
          targetFileName = selectedFile.name.endsWith('.enc')
            ? selectedFile.name.slice(0, -4)
            : `decrypted_${selectedFile.name}`;
        }
      } else {
        inputData = new TextEncoder().encode(textInput);
        targetFileName = mode === 'encrypt' ? 'metin.txt.enc' : 'cozulen_metin.txt';
      }

      if (mode === 'encrypt') {
        const encrypted = await encryptBuffer(inputData, password);
        await saveAndExportFile(targetFileName, encrypted);
        setSuccessMessage(
          `Dosya başarıyla AES-GCM 256-bit ile şifrelendi ve kaydedildi (${targetFileName}).`
        );
      } else {
        const decrypted = await decryptBuffer(inputData, password);
        
        // If processing text input or text file, display inline text result
        try {
          const str = uint8ArrayToString(decrypted);
          if (str && /^[\x00-\x7F\u0080-\uFFFF]*$/.test(str)) {
            setDecryptedText(str);
          }
        } catch {
          // Binary data decrypted
        }

        await saveAndExportFile(targetFileName, decrypted);
        setSuccessMessage(
          `Dosya şifresi başarıyla çözüldü ve kaydedildi (${targetFileName}).`
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || 'İşlem sırasında beklenmeyen bir hata meydana geldi.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Tool Info Header */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="lock-closed-outline" size={26} color={theme.primary} />
          <View style={styles.cardTitleBox}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
              Güvenli Yerel Dosya Şifreleme
            </Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
              Web Crypto AES-GCM 256-bit ve PBKDF2 ile tamamen cihazınızda şifreleyin
            </Text>
          </View>
        </View>
      </View>

      {/* Mode Switcher Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: theme.surfaceVariant }]}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            mode === 'encrypt' && { backgroundColor: theme.card, borderRadius: borderRadius.sm },
          ]}
          onPress={() => {
            setMode('encrypt');
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
        >
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={mode === 'encrypt' ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: mode === 'encrypt' ? theme.primary : theme.textSecondary },
            ]}
          >
            Dosya Şifrele
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            mode === 'decrypt' && { backgroundColor: theme.card, borderRadius: borderRadius.sm },
          ]}
          onPress={() => {
            setMode('decrypt');
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
        >
          <Ionicons
            name="key-outline"
            size={18}
            color={mode === 'decrypt' ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: mode === 'decrypt' ? theme.primary : theme.textSecondary },
            ]}
          >
            Şifre Çöz
          </Text>
        </TouchableOpacity>
      </View>

      {/* File Selector Section */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
          1. İşlenecek Dosyayı Seçin
        </Text>

        {selectedFile ? (
          <View style={[styles.fileSelectedBox, { backgroundColor: theme.surfaceVariant }]}>
            <Ionicons name="document-text-outline" size={28} color={theme.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.fileName, { color: theme.textPrimary }]} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <Text style={[styles.fileSize, { color: theme.textSecondary }]}>
                {(selectedFile.size / 1024).toFixed(1)} KB
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedFile(null)}>
              <Ionicons name="close-circle" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.dropZone, { borderColor: theme.primary, backgroundColor: theme.ripple }]}
            onPress={handlePickFile}
          >
            <Ionicons name="cloud-upload-outline" size={36} color={theme.primary} />
            <Text style={[styles.dropZoneText, { color: theme.primary }]}>
              {mode === 'encrypt'
                ? 'Şifrelenecek Dosyayı Seçin'
                : 'Şifresi Çözülecek (.enc) Dosyayı Seçin'}
            </Text>
            <Text style={[styles.dropZoneSub, { color: theme.textMuted }]}>
              Tüm dosya türleri desteklenir (PDF, Görsel, Belge, Zip vb.)
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.orText, { color: theme.textMuted }]}>veya Doğrudan Metin Girin:</Text>

        <TextInput
          style={[
            styles.textInputArea,
            {
              backgroundColor: theme.inputBackground,
              borderColor: theme.inputBorder,
              color: theme.textPrimary,
            },
          ]}
          multiline
          numberOfLines={3}
          placeholder={
            mode === 'encrypt'
              ? 'Şifrelenecek gizli metni buraya yazın...'
              : 'Çözülecek veriyi buraya yapıştırın...'
          }
          placeholderTextColor={theme.textMuted}
          value={textInput}
          onChangeText={setTextInput}
        />
      </View>

      {/* Password Section */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
          2. Parolanızı Belirleyin
        </Text>

        <View style={styles.passwordWrapper}>
          <TextInput
            style={[
              styles.passwordInput,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.inputBorder,
                color: theme.textPrimary,
              },
            ]}
            secureTextEntry={!showPassword}
            placeholder="Güçlü anahtar parola..."
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {password.length > 0 && (
          <View style={styles.strengthRow}>
            <View
              style={[
                styles.strengthDot,
                { backgroundColor: pwdStrength.color },
              ]}
            />
            <Text style={[styles.strengthText, { color: pwdStrength.color }]}>
              Parola Durumu: {pwdStrength.label}
            </Text>
          </View>
        )}
      </View>

      {/* Error / Success Feedback Banners */}
      {errorMessage && (
        <View style={[styles.alertBanner, { backgroundColor: theme.errorContainer }]}>
          <Ionicons name="alert-circle" size={20} color={theme.error} />
          <Text style={[styles.alertText, { color: theme.error }]}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={[styles.alertBanner, { backgroundColor: theme.successContainer }]}>
          <Ionicons name="checkmark-circle" size={20} color={theme.success} />
          <Text style={[styles.alertText, { color: theme.success }]}>{successMessage}</Text>
        </View>
      )}

      {/* Decrypted inline text result view */}
      {decryptedText && (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
            Çözülen Metin İçeriği:
          </Text>
          <View style={[styles.decryptedBox, { backgroundColor: theme.surfaceVariant }]}>
            <Text style={{ color: theme.textPrimary, fontFamily: 'monospace' }}>
              {decryptedText}
            </Text>
          </View>
        </View>
      )}

      {/* Security Note */}
      <View style={styles.securityBox}>
        <Ionicons name="shield-checkmark-outline" size={16} color={theme.textMuted} />
        <Text style={[styles.securityText, { color: theme.textMuted }]}>
          Sıfır Bilgi Politikası: Parolanız cihazınızdan hiçbir zaman çıkmaz veya bir yere kaydedilmez.
        </Text>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          {
            backgroundColor: mode === 'encrypt' ? theme.primary : theme.accent,
            opacity: isProcessing ? 0.7 : 1,
          },
        ]}
        onPress={handleProcess}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons
              name={mode === 'encrypt' ? 'lock-closed-outline' : 'key-outline'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.submitBtnText}>
              {mode === 'encrypt' ? 'AES-GCM ile Şifrele & Kaydet' : 'Şifreyi Çöz & Dışa Aktar'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitleBox: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZoneText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  dropZoneSub: {
    fontSize: 12,
    marginTop: 4,
  },
  fileSelectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    fontSize: 12,
    marginTop: 2,
  },
  orText: {
    fontSize: 12,
    marginVertical: 10,
    textAlign: 'center',
  },
  textInputArea: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    paddingRight: 40,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  strengthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  decryptedBox: {
    padding: 12,
    borderRadius: 8,
    maxHeight: 160,
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 6,
  },
  securityText: {
    fontSize: 11,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
