import Button from "./ToggleButton"
interface SettingButtonDescProps {
  title: string
  description: string
  isEnabled: boolean
  onToggle: () => void
}

const SettingButtonDesc = ({ title, description, isEnabled, onToggle }: SettingButtonDescProps) => {
  return (
    <div className="flex flex-row justify-between items-start py-4">
      <div className="flex flex-col flex-1 pr-6">
        <h3 className="text-lg font-medium text-black dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-light-muted dark:text-dark-muted mt-1">
          {description}
        </p>
      </div>
      <Button isEnabled={isEnabled} onToggle={onToggle} />
    </div>
  )
}

export default SettingButtonDesc
