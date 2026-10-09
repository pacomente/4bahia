import { useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

const HEIGHT = 180;

// Firma con el dedo. onChange recibe un data URL SVG (o null si está vacía).
export default function SignaturePad({ onChange }) {
  const [paths, setPaths] = useState([]);
  const current = useRef('');
  const [, force] = useState(0);
  const width = useRef(320);

  const emit = (list) => {
    if (!list.length) return onChange(null);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width.current)}" height="${HEIGHT}" viewBox="0 0 ${Math.round(width.current)} ${HEIGHT}">`
      + list.map((d) => `<path d="${d}" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`).join('')
      + '</svg>';
    onChange(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // Que el scroll de la pantalla no le saque el gesto a la firma.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      current.current = `M${x.toFixed(1)},${y.toFixed(1)}`;
      force((n) => n + 1);
    },
    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      current.current += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      force((n) => n + 1);
    },
    onPanResponderRelease: () => {
      const d = current.current;
      current.current = '';
      setPaths((prev) => { const next = [...prev, d]; emit(next); return next; });
    },
  })).current;

  return (
    <View>
      <View
        onLayout={(e) => { width.current = e.nativeEvent.layout.width; }}
        style={{ height: HEIGHT, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' }}
        {...responder.panHandlers}
      >
        <Svg width="100%" height={HEIGHT}>
          {paths.map((d, i) => <Path key={i} d={d} stroke="#000" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          {current.current ? <Path d={current.current} stroke="#000" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        </Svg>
        {!paths.length && !current.current && (
          <Text pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: HEIGHT / 2 - 10, color: '#aaa' }}>Firmá acá</Text>
        )}
      </View>
      <Pressable onPress={() => { setPaths([]); emit([]); }} style={{ alignSelf: 'flex-end', padding: 6 }}>
        <Text style={{ color: colors.info, fontWeight: '600' }}>Borrar firma</Text>
      </Pressable>
    </View>
  );
}
