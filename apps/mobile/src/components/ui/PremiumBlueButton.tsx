import type { ComponentProps, ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { StyleProp, ViewStyle } from "react-native";
import { TravaButton } from "./TravaButton";
type IconName=ComponentProps<typeof Ionicons>["name"];
export const TRAVA_BUTTON_GRADIENT=["#FFFFFF","#FFFFFF","#FFFFFF"] as const;
export function PremiumBlueButton({label,subtitle,icon,onPress,disabled=false,loading=false,style,trailing}:{label:string;subtitle?:string;icon?:IconName;onPress():void;disabled?:boolean;loading?:boolean;style?:StyleProp<ViewStyle>;trailing?:ReactNode;}){
 return <TravaButton tone="blue" label={label} subtitle={subtitle} icon={icon} onPress={onPress} disabled={disabled} loading={loading} trailingIcon={trailing?null:"chevron-forward"} style={style}/>;
}
