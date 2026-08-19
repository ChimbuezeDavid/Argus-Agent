package com.argus.agent.monitors

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Argus Agent Native Accessibility RPA Service.
 * Provides autonomous on-device screen reading, UI element interaction,
 * text typing, gestures, and global navigation across all Android applications.
 */
class ArgusAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "ArgusAccessibility"
        var instance: ArgusAccessibilityService? = null
            private set

        val isServiceActive: Boolean
            get() = instance != null
    }

    var currentPackageName: String = ""
        private set

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i(TAG, "Argus Accessibility RPA Service connected and ready.")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        event.packageName?.let {
            currentPackageName = it.toString()
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "Argus Accessibility Service interrupted.")
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) {
            instance = null
        }
        Log.i(TAG, "Argus Accessibility Service destroyed.")
    }

    /**
     * Inspects the current active window hierarchy and returns structured UI nodes.
     */
    fun inspectScreenNodes(): List<Map<String, Any?>> {
        val root = rootInActiveWindow ?: return emptyList()
        val nodesList = mutableListOf<Map<String, Any?>>()
        val currentPkg = root.packageName?.toString() ?: currentPackageName

        fun traverse(node: AccessibilityNodeInfo?) {
            if (node == null) return

            val bounds = Rect()
            node.getBoundsInScreen(bounds)

            // Only capture nodes with dimensions on screen
            if (bounds.width() > 0 && bounds.height() > 0 && node.isVisibleToUser) {
                val nodeMap = mutableMapOf<String, Any?>()
                val text = node.text?.toString()
                val desc = node.contentDescription?.toString()
                val viewId = node.viewIdResourceName

                nodeMap["text"] = text ?: ""
                nodeMap["contentDescription"] = desc ?: ""
                nodeMap["viewId"] = viewId ?: ""
                nodeMap["className"] = node.className?.toString() ?: ""
                nodeMap["packageName"] = node.packageName?.toString() ?: currentPkg
                nodeMap["isClickable"] = node.isClickable
                nodeMap["isEditable"] = node.isEditable
                nodeMap["isScrollable"] = node.isScrollable
                nodeMap["isFocused"] = node.isFocused
                nodeMap["isEnabled"] = node.isEnabled
                nodeMap["bounds"] = mapOf(
                    "left" to bounds.left,
                    "top" to bounds.top,
                    "right" to bounds.right,
                    "bottom" to bounds.bottom,
                    "centerX" to bounds.centerX(),
                    "centerY" to bounds.centerY()
                )

                // Only record nodes that have text, description, ID, or are interactive
                if (!text.isNullOrBlank() || !desc.isNullOrBlank() || !viewId.isNullOrBlank() || node.isClickable || node.isEditable) {
                    nodesList.add(nodeMap)
                }
            }

            for (i in 0 until node.childCount) {
                traverse(node.getChild(i))
            }
        }

        try {
            traverse(root)
        } catch (e: Exception) {
            Log.e(TAG, "Error traversing node hierarchy", e)
        }

        return nodesList
    }

    /**
     * Finds and clicks an element by its visible text or content description.
     */
    fun clickByText(targetText: String, exactMatch: Boolean = false): Boolean {
        val root = rootInActiveWindow ?: return false
        var targetNode: AccessibilityNodeInfo? = null

        fun search(node: AccessibilityNodeInfo?) {
            if (node == null || targetNode != null) return

            val text = node.text?.toString()
            val desc = node.contentDescription?.toString()

            val matches = if (exactMatch) {
                (text != null && text.equals(targetText, ignoreCase = true)) ||
                (desc != null && desc.equals(targetText, ignoreCase = true))
            } else {
                (text != null && text.contains(targetText, ignoreCase = true)) ||
                (desc != null && desc.contains(targetText, ignoreCase = true))
            }

            if (matches) {
                targetNode = node
                return
            }

            for (i in 0 until node.childCount) {
                search(node.getChild(i))
            }
        }

        search(root)

        if (targetNode != null) {
            // Find the closest clickable parent if the matching node itself isn't clickable
            var clickableNode: AccessibilityNodeInfo? = targetNode
            while (clickableNode != null && !clickableNode.isClickable) {
                clickableNode = clickableNode.parent
            }

            val nodeToClick = clickableNode ?: targetNode
            val success = nodeToClick?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
            if (success) {
                Log.i(TAG, "Successfully clicked element matching: '$targetText'")
                return true
            }

            // Fallback: Tap center coordinates via gesture if performAction fails
            val bounds = Rect()
            targetNode!!.getBoundsInScreen(bounds)
            if (bounds.width() > 0 && bounds.height() > 0) {
                return clickCoordinates(bounds.centerX().toFloat(), bounds.centerY().toFloat())
            }
        }

        return false
    }

    /**
     * Finds and clicks an element by its resource View ID.
     */
    fun clickById(viewId: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val matchingNodes = root.findAccessibilityNodeInfosByViewId(viewId)

        if (!matchingNodes.isNullOrEmpty()) {
            val node = matchingNodes[0]
            var clickableNode: AccessibilityNodeInfo? = node
            while (clickableNode != null && !clickableNode.isClickable) {
                clickableNode = clickableNode.parent
            }

            val nodeToClick = clickableNode ?: node
            val success = nodeToClick.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            if (success) return true

            val bounds = Rect()
            node.getBoundsInScreen(bounds)
            return clickCoordinates(bounds.centerX().toFloat(), bounds.centerY().toFloat())
        }

        return false
    }

    /**
     * Types text into an editable input field.
     */
    fun inputText(text: String, viewId: String? = null, targetText: String? = null): Boolean {
        val root = rootInActiveWindow ?: return false
        var targetNode: AccessibilityNodeInfo? = null

        // 1. If viewId is specified, find by ID
        if (!viewId.isNullOrBlank()) {
            val matching = root.findAccessibilityNodeInfosByViewId(viewId)
            if (!matching.isNullOrEmpty()) {
                targetNode = matching.firstOrNull { it.isEditable } ?: matching[0]
            }
        }

        // 2. If targetText is specified, find node containing text or description
        if (targetNode == null && !targetText.isNullOrBlank()) {
            fun search(node: AccessibilityNodeInfo?) {
                if (node == null || targetNode != null) return
                if (node.isEditable && (node.text?.contains(targetText, ignoreCase = true) == true ||
                                        node.contentDescription?.contains(targetText, ignoreCase = true) == true)) {
                    targetNode = node
                    return
                }
                for (i in 0 until node.childCount) {
                    search(node.getChild(i))
                }
            }
            search(root)
        }

        // 3. Fallback: Find currently focused editable node or first editable node on screen
        if (targetNode == null) {
            targetNode = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            if (targetNode == null || !targetNode.isEditable) {
                fun findFirstEditable(node: AccessibilityNodeInfo?) {
                    if (node == null || targetNode != null) return
                    if (node.isEditable && node.isVisibleToUser) {
                        targetNode = node
                        return
                    }
                    for (i in 0 until node.childCount) {
                        findFirstEditable(node.getChild(i))
                    }
                }
                findFirstEditable(root)
            }
        }

        if (targetNode != null) {
            targetNode.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
            val arguments = Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            }
            val success = targetNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
            if (success) {
                Log.i(TAG, "Successfully typed text into input field.")
                return true
            }
        }

        return false
    }

    /**
     * Injects a touch gesture tap at exact screen coordinates (x, y).
     */
    fun clickCoordinates(x: Float, y: Float): Boolean {
        val path = Path().apply {
            moveTo(x, y)
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 50))
            .build()

        var dispatched = false
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                super.onCompleted(gestureDescription)
                dispatched = true
                Log.i(TAG, "Gesture tap completed at ($x, $y)")
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                super.onCancelled(gestureDescription)
                Log.w(TAG, "Gesture tap cancelled at ($x, $y)")
            }
        }, null)

        return true
    }

    /**
     * Scrolls the current screen in the given direction (UP or DOWN).
     */
    fun scrollScreen(direction: String): Boolean {
        val root = rootInActiveWindow ?: return false
        var scrollableNode: AccessibilityNodeInfo? = null

        fun findScrollable(node: AccessibilityNodeInfo?) {
            if (node == null || scrollableNode != null) return
            if (node.isScrollable && node.isVisibleToUser) {
                scrollableNode = node
                return
            }
            for (i in 0 until node.childCount) {
                findScrollable(node.getChild(i))
            }
        }

        findScrollable(root)

        if (scrollableNode != null) {
            val action = if (direction.equals("UP", ignoreCase = true)) {
                AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
            } else {
                AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
            }
            return scrollableNode!!.performAction(action)
        }

        return false
    }

    /**
     * Executes global navigation actions (HOME, BACK, RECENTS, NOTIFICATIONS, QUICK_SETTINGS, LOCK_SCREEN).
     */
    fun executeGlobalAction(actionName: String): Boolean {
        val action = when (actionName.uppercase()) {
            "BACK" -> GLOBAL_ACTION_BACK
            "HOME" -> GLOBAL_ACTION_HOME
            "RECENTS" -> GLOBAL_ACTION_RECENTS
            "NOTIFICATIONS" -> GLOBAL_ACTION_NOTIFICATIONS
            "QUICK_SETTINGS" -> GLOBAL_ACTION_QUICK_SETTINGS
            "LOCK_SCREEN" -> GLOBAL_ACTION_LOCK_SCREEN
            else -> GLOBAL_ACTION_BACK
        }
        return performGlobalAction(action)
    }
}
