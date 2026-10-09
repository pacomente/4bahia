import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, s, STATUS } from '../theme';

export function Button({ title, onPress, variant = 'primary', disabled, busy, style }) {
  const bg = { primary: colors.brand, accent: colors.accent, ghost: 'transparent', danger: colors.bad }[variant];
  const fg = variant === 'ghost' ? colors.text : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [{
        backgroundColor: bg, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
        borderWidth: variant === 'ghost' ? 1 : 0, borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, minHeight: 50,
      }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '700', fontSize: 16 }}>{title}</Text>}
    </Pressable>
  );
}

export function Badge({ status, label, tone }) {
  const [text, t] = STATUS[status] ?? [label ?? status, tone ?? 'neutral'];
  const palette = {
    good: [colors.goodBg, colors.good], warn: [colors.warnBg, colors.warn], bad: [colors.badBg, colors.bad],
    info: [colors.infoBg, colors.info], neutral: ['#efeeea', colors.text2],
  }[tone ?? t];
  return (
    <View style={{ backgroundColor: palette[0], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: palette[1], fontSize: 12, fontWeight: '700' }}>{label ?? text}</Text>
    </View>
  );
}

export function Field({ label, ...props }) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor="#9a998f" {...props} />
    </View>
  );
}

export function Header({ title, subtitle, onBack, right }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.brand, paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 16 }}>
      <View style={s.between}>
        <View style={[s.row, { flex: 1 }]}>
          {onBack && (
            <Pressable onPress={onBack} hitSlop={16} accessibilityLabel="Volver" style={{ paddingRight: 6 }}>
              <Text style={{ color: '#fff', fontSize: 26, lineHeight: 28 }}>‹</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 19, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={{ color: 'rgba(255,255,255,.75)', fontSize: 13 }} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>
        {right}
      </View>
    </View>
  );
}

export function Notice({ tone = 'warn', children }) {
  const palette = { warn: [colors.warnBg, colors.warn], bad: [colors.badBg, colors.bad], good: [colors.goodBg, colors.good], info: [colors.infoBg, colors.info] }[tone];
  return (
    <View style={{ backgroundColor: palette[0], borderRadius: 10, padding: 12 }}>
      <Text style={{ color: palette[1], fontSize: 14 }}>{children}</Text>
    </View>
  );
}
